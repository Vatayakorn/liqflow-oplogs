/**
 * Session Statistics Utilities
 * Calculate metrics for Session Summary Card
 */

import type { OplogSession } from '$lib/api/oplog';
import type { OtcTransaction } from '$lib/config/tradingConfig';

export interface OtcStats {
    totalVolume: number;
    count: number;
    buyCount: number;
    sellCount: number;
    buyVolume: number;
    sellVolume: number;
}

export interface PrefundStatus {
    current: number;
    target: number;
    percent: number;
    status: 'low' | 'warning' | 'normal' | 'full';
}

export interface SpreadInfo {
    value: number | null;
    higher: string | null;
    formatted: string;
}

export interface DurationInfo {
    minutes: number;
    formatted: string;
}

export interface AttachmentCounts {
    imageCount: number;
    audioCount: number;
}

export interface ArbitrageInfo {
    // Direction 1: Buy from Broker → Sell on Exchange (Exchange Bid - Broker Ask)
    bitkubDiff: number | null;      // Bitkub Bid - Broker Ask (THB)
    binanceDiff: number | null;     // BinanceTH Bid - Broker Ask (THB)
    // Direction 2: Buy from Exchange → Sell to Broker (Broker Bid - Exchange Ask)
    bitkubReverseDiff: number | null;   // Broker Bid - Bitkub Ask (THB)
    binanceReverseDiff: number | null;  // Broker Bid - BinanceTH Ask (THB)
    // Best opportunity info
    bestExchange: 'Bitkub' | 'BinanceTH' | null;
    bestDirection: 'toBroker' | 'toExchange' | null;  // Which direction is better
    bestDiffSatang: number | null;  // Best diff in satang (สตางค์)
    hasOpportunity: boolean;
}

export interface ExchangeVolumeInfo {
    bitkub: number | null;
    binanceTH: number | null;
}

export interface SessionStats {
    otc: OtcStats;
    prefund: PrefundStatus;
    spread: SpreadInfo;
    duration: DurationInfo;
    attachments: AttachmentCounts;
    arbitrage: ArbitrageInfo;
    exchangeVolume: ExchangeVolumeInfo;
}

/**
 * Calculate OTC transaction statistics
 */
export function calculateOtcStats(transactions: OtcTransaction[] | null | undefined): OtcStats {
    if (!transactions || transactions.length === 0) {
        return {
            totalVolume: 0,
            count: 0,
            buyCount: 0,
            sellCount: 0,
            buyVolume: 0,
            sellVolume: 0
        };
    }

    const buyTxns = transactions.filter(tx => tx.action === 'BUY');
    const sellTxns = transactions.filter(tx => tx.action === 'SELL');

    return {
        totalVolume: transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0),
        count: transactions.length,
        buyCount: buyTxns.length,
        sellCount: sellTxns.length,
        buyVolume: buyTxns.reduce((sum, tx) => sum + (tx.amount || 0), 0),
        sellVolume: sellTxns.reduce((sum, tx) => sum + (tx.amount || 0), 0)
    };
}

/**
 * Calculate prefund status with percentage and status level
 */
export function calculatePrefundStatus(current: number | null, target: number | null): PrefundStatus {
    const curr = current || 0;
    const tgt = target || 760000; // Default target

    const percent = tgt > 0 ? Math.round((curr / tgt) * 100) : 0;

    let status: PrefundStatus['status'] = 'normal';
    if (percent >= 90) status = 'full';
    else if (percent >= 70) status = 'normal';
    else if (percent >= 50) status = 'warning';
    else status = 'low';

    return { current: curr, target: tgt, percent, status };
}

/**
 * Parse spread information from session data
 */
export function parseSpreadInfo(exchangeDiff: string | null, exchangeHigher: string | null): SpreadInfo {
    if (!exchangeDiff) {
        return { value: null, higher: null, formatted: '-' };
    }

    // Parse numeric value from string like "+150" or "-50"
    const numericValue = parseFloat(exchangeDiff.replace(/[^0-9.-]/g, ''));

    return {
        value: isNaN(numericValue) ? null : numericValue,
        higher: exchangeHigher || null,
        formatted: exchangeDiff
    };
}

/**
 * Calculate session duration from start and end times
 */
export function calculateDuration(startTime: string | null, endTime: string | null): DurationInfo {
    if (!startTime) {
        return { minutes: 0, formatted: '-' };
    }

    const parseTime = (timeStr: string): number => {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };

    const startMinutes = parseTime(startTime);
    let endMinutes = endTime ? parseTime(endTime) : parseTime(startTime);

    // Handle cross-midnight (e.g., 22:00 - 07:00)
    if (endMinutes < startMinutes) {
        endMinutes += 24 * 60;
    }

    const durationMinutes = endMinutes - startMinutes;
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;

    let formatted = '';
    if (hours > 0) formatted += `${hours}h`;
    if (minutes > 0) formatted += ` ${minutes}m`;
    if (!formatted) formatted = '0m';

    return { minutes: durationMinutes, formatted: formatted.trim() };
}

/**
 * Count attachments (images and audio)
 */
export function countAttachments(session: OplogSession): AttachmentCounts {
    return {
        imageCount: session.images?.length || 0,
        audioCount: session.audio?.length || 0
    };
}

/**
 * Calculate arbitrage opportunity between exchanges and broker
 * Direction 1: Exchange Best Bid - Broker Best Ask (buy from broker, sell on exchange)
 * Direction 2: Broker Best Bid - Exchange Best Ask (buy from exchange, sell to broker)
 * Positive value means opportunity exists
 */
export function calculateArbitrageInfo(session: OplogSession): ArbitrageInfo {
    // Parse exchange prices (format: "bid/ask")
    const parsePrice = (priceStr: string | null): { bid: number; ask: number } | null => {
        if (!priceStr) return null;
        const parts = priceStr.split('/');
        if (parts.length !== 2) return null;
        const bid = parseFloat(parts[0]);
        const ask = parseFloat(parts[1]);
        if (isNaN(bid) || isNaN(ask)) return null;
        return { bid, ask };
    };

    const bitkubPrice = parsePrice(session.exchange1_price);
    const binancePrice = parsePrice(session.exchange2_price);
    const brokerAsk = session.btz_ask;
    const brokerBid = session.btz_bid;

    // Direction 1: Buy from Broker → Sell on Exchange (Exchange Bid - Broker Ask)
    let bitkubDiff: number | null = null;
    let binanceDiff: number | null = null;

    if (bitkubPrice && brokerAsk) {
        bitkubDiff = bitkubPrice.bid - brokerAsk;
    }
    if (binancePrice && brokerAsk) {
        binanceDiff = binancePrice.bid - brokerAsk;
    }

    // Direction 2: Buy from Exchange → Sell to Broker (Broker Bid - Exchange Ask)
    let bitkubReverseDiff: number | null = null;
    let binanceReverseDiff: number | null = null;

    if (bitkubPrice && brokerBid) {
        bitkubReverseDiff = brokerBid - bitkubPrice.ask;
    }
    if (binancePrice && brokerBid) {
        binanceReverseDiff = brokerBid - binancePrice.ask;
    }

    // Find best opportunity across all directions
    let bestExchange: ArbitrageInfo['bestExchange'] = null;
    let bestDirection: ArbitrageInfo['bestDirection'] = null;
    let bestDiffSatang: number | null = null;

    // All candidates: [diff, exchange, direction]
    const candidates: Array<[number, ArbitrageInfo['bestExchange'], ArbitrageInfo['bestDirection']]> = [];

    if (bitkubDiff !== null && bitkubDiff > 0) {
        candidates.push([bitkubDiff, 'Bitkub', 'toExchange']);
    }
    if (binanceDiff !== null && binanceDiff > 0) {
        candidates.push([binanceDiff, 'BinanceTH', 'toExchange']);
    }
    if (bitkubReverseDiff !== null && bitkubReverseDiff > 0) {
        candidates.push([bitkubReverseDiff, 'Bitkub', 'toBroker']);
    }
    if (binanceReverseDiff !== null && binanceReverseDiff > 0) {
        candidates.push([binanceReverseDiff, 'BinanceTH', 'toBroker']);
    }

    // Find the best (highest diff)
    if (candidates.length > 0) {
        candidates.sort((a, b) => b[0] - a[0]); // Sort descending by diff
        const best = candidates[0];
        bestDiffSatang = Math.round(best[0] * 100); // THB to satang
        bestExchange = best[1];
        bestDirection = best[2];
    }

    return {
        bitkubDiff,
        binanceDiff,
        bitkubReverseDiff,
        binanceReverseDiff,
        bestExchange,
        bestDirection,
        bestDiffSatang,
        hasOpportunity: bestDiffSatang !== null && bestDiffSatang > 0
    };
}

/**
 * Parse exchange volume from market_context
 */
export function parseExchangeVolume(session: OplogSession): ExchangeVolumeInfo {
    const marketContext = session.market_context;

    return {
        bitkub: marketContext?.exchangeVolume?.bitkub ?? null,
        binanceTH: marketContext?.exchangeVolume?.binanceTH ?? null
    };
}

/**
 * Calculate all session statistics
 */
export function calculateSessionStats(session: OplogSession): SessionStats {
    return {
        otc: calculateOtcStats(session.otc_transactions),
        prefund: calculatePrefundStatus(session.prefund_current, session.prefund_target),
        spread: parseSpreadInfo(session.exchange_diff, session.exchange_higher),
        duration: calculateDuration(session.start_time, session.end_time),
        attachments: countAttachments(session),
        arbitrage: calculateArbitrageInfo(session),
        exchangeVolume: parseExchangeVolume(session)
    };
}

/**
 * Format large numbers (e.g., 2500000 -> "2.5M")
 */
export function formatVolume(amount: number): string {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
    return amount.toLocaleString();
}

/**
 * Get status color based on prefund status
 */
export function getPrefundStatusColor(status: PrefundStatus['status']): string {
    switch (status) {
        case 'full': return 'var(--status-excellent, #34C759)';
        case 'normal': return 'var(--status-good, #007AFF)';
        case 'warning': return 'var(--status-warning, #FF9500)';
        case 'low': return 'var(--status-critical, #FF3B30)';
        default: return 'var(--color-text-secondary)';
    }
}
