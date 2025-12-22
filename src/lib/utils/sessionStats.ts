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

export interface SessionStats {
    otc: OtcStats;
    prefund: PrefundStatus;
    spread: SpreadInfo;
    duration: DurationInfo;
    attachments: AttachmentCounts;
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
 * Calculate all session statistics
 */
export function calculateSessionStats(session: OplogSession): SessionStats {
    return {
        otc: calculateOtcStats(session.otc_transactions),
        prefund: calculatePrefundStatus(session.prefund_current, session.prefund_target),
        spread: parseSpreadInfo(session.exchange_diff, session.exchange_higher),
        duration: calculateDuration(session.start_time, session.end_time),
        attachments: countAttachments(session)
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
