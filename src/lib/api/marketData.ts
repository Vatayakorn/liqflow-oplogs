/**
 * Market Data API Service
 * Fetches real-time prices from various exchanges
 */

import { supabase } from '$lib/supabaseClient';

// API Endpoints
const ENDPOINTS = {
    maxbit: 'https://maxbitapi-prd.unit.co.th/api/otc',
    bitkub: {
        ticker: 'https://api.bitkub.com/api/market/ticker',
        depth: 'https://api.bitkub.com/api/market/depth',
    },
    binanceTH: {
        depth: 'https://api.binance.th/api/v1/depth',
    },
    fx: 'https://open.er-api.com/v6/latest/USD', // Free FX rate API
};

// MaxBit API credentials
const MAXBIT_CONFIG = {
    secretApi: 'MAXBITOTC',
    secretKey: '2e104ac5-2cea-41b9-bb02-15ff1580917b',
    groupId: 'C38a571cc9b25c98313b2b4e9de20854f',
};

// Types
export interface BrokerPrice {
    bid: number;
    ask: number;
    source: string;
    timestamp: Date;
    raw?: any;
}

export interface OrderBookEntry {
    price: number;
    amount: number;
}

export interface OrderBook {
    bids: OrderBookEntry[];
    asks: OrderBookEntry[];
    bestBid: number;
    bestAsk: number;
    source: string;
    timestamp: Date;
    raw?: any;
}

export interface FxRate {
    rate: number;
    source: string;
    timestamp: Date;
    raw?: any;
}

/**
 * Fetch latest data from Supabase 'market_data' table
 */
async function fetchLatestFromDb(source: string, symbol?: string, validitySeconds = 5): Promise<any | null> {
    try {
        let query = supabase
            .from('market_data')
            .select('*')
            .eq('source', source)
            .order('created_at', { ascending: false })
            .limit(1);

        if (symbol) {
            query = query.eq('symbol', symbol);
        }

        const { data, error } = await query.single();

        if (error || !data) return null;

        // Check freshness
        const created = new Date(data.created_at);
        const now = new Date();
        const diffSeconds = (now.getTime() - created.getTime()) / 1000;

        if (diffSeconds > validitySeconds) {
            console.warn(`[MarketData] DB data for ${source} is stale (${diffSeconds.toFixed(1)}s old). Fallback to API.`);
            return null;
        }

        return data;
    } catch (err) {
        console.error(`[MarketData] DB fetch error for ${source}:`, err);
        return null;
    }
}

/**
 * Fetch USD/THB FX rate (DB First -> API Fallback)
 */
export async function fetchFxRate(): Promise<FxRate> {
    // 1. Try DB
    const dbData = await fetchLatestFromDb('fx', 'USD_THB');
    if (dbData) {
        return {
            rate: dbData.price,
            source: 'FX (Bridge)',
            timestamp: new Date(dbData.created_at),
            raw: dbData.raw_data
        };
    }

    // 2. API Fallback
    try {
        const response = await fetch('/api/market/fx');
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        return {
            rate: data.rate,
            source: data.source,
            timestamp: new Date(data.timestamp),
        };
    } catch (error) {
        console.error('FX API error:', error);
        throw error;
    }
}

/**
 * Fetch BTZ (MaxBit) broker prices (DB First -> API Fallback)
 */
export async function fetchMaxbitPrice(symbol = 'usdt'): Promise<BrokerPrice> {
    // 1. Try DB
    // Bridge uses 'maxbit', 'USDT'
    const dbData = await fetchLatestFromDb('maxbit', 'USDT');
    if (dbData) {
        return {
            bid: Number(dbData.bid),
            ask: Number(dbData.ask),
            source: 'BTZ (Bridge)',
            timestamp: new Date(dbData.created_at),
            raw: dbData.raw_data
        };
    }

    // 2. API Fallback
    try {
        const response = await fetch(`/api/market/maxbit?symbol=${symbol}`);
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        return {
            bid: parseFloat(data.result.bid),
            ask: parseFloat(data.result.ask),
            source: 'BTZ (MaxBit)',
            timestamp: new Date(),
        };
    } catch (error) {
        console.error('MaxBit API error:', error);
        throw error;
    }
}

/**
 * Fetch Bitkub order book (DB First -> API Fallback)
 */
export async function fetchBitkubOrderBook(symbol = 'THB_USDT', limit = 5): Promise<OrderBook> {
    // 1. Try DB
    const dbData = await fetchLatestFromDb('bitkub', 'THB_USDT');
    if (dbData && dbData.order_book) {
        const bids = dbData.order_book.bids.slice(0, limit).map((b: any) => ({
            price: b[0], amount: b[1]
        }));
        const asks = dbData.order_book.asks.slice(0, limit).map((a: any) => ({
            price: a[0], amount: a[1]
        }));

        return {
            bids,
            asks,
            bestBid: bids[0]?.price || 0,
            bestAsk: asks[0]?.price || 0,
            source: 'Bitkub (Bridge)',
            timestamp: new Date(dbData.created_at),
            raw: dbData.raw_data
        };
    }

    // 2. API Fallback
    try {
        const response = await fetch(`${ENDPOINTS.bitkub.depth}?sym=${symbol}&lmt=${limit}`);
        const data = await response.json();

        const bids = data.bids.map((b: [number, number]) => ({
            price: b[0],
            amount: b[1],
        }));

        const asks = data.asks.map((a: [number, number]) => ({
            price: a[0],
            amount: a[1],
        }));

        return {
            bids,
            asks,
            bestBid: bids[0]?.price || 0,
            bestAsk: asks[0]?.price || 0,
            source: 'Bitkub',
            timestamp: new Date(),
        };
    } catch (error) {
        console.error('Bitkub API error:', error);
        throw error;
    }
}

/**
 * Fetch BinanceTH order book (DB First -> API Fallback)
 */
export async function fetchBinanceTHOrderBook(symbol = 'USDTTHB', limit = 5): Promise<OrderBook> {
    // 1. Try DB
    const dbData = await fetchLatestFromDb('binance_th', 'USDTTHB');
    if (dbData && dbData.order_book) {
        const bids = dbData.order_book.bids.slice(0, limit).map((b: any) => ({
            price: parseFloat(b[0]), amount: parseFloat(b[1])
        }));
        const asks = dbData.order_book.asks.slice(0, limit).map((a: any) => ({
            price: parseFloat(a[0]), amount: parseFloat(a[1])
        }));

        return {
            bids,
            asks,
            bestBid: bids[0]?.price || 0,
            bestAsk: asks[0]?.price || 0,
            source: 'BinanceTH (Bridge)',
            timestamp: new Date(dbData.created_at),
            raw: dbData.raw_data
        };
    }

    // 2. API Fallback
    try {
        const response = await fetch(`${ENDPOINTS.binanceTH.depth}?symbol=${symbol}&limit=${limit}`);
        const data = await response.json();

        const bids = data.bids.map((b: [string, string]) => ({
            price: parseFloat(b[0]),
            amount: parseFloat(b[1]),
        }));

        const asks = data.asks.map((a: [string, string]) => ({
            price: parseFloat(a[0]),
            amount: parseFloat(a[1]),
        }));

        return {
            bids,
            asks,
            bestBid: bids[0]?.price || 0,
            bestAsk: asks[0]?.price || 0,
            source: 'BinanceTH',
            timestamp: new Date(),
        };
    } catch (error) {
        console.error('BinanceTH API error:', error);
        throw error;
    }
}

/**
 * Fetch all market data at once
 */
export async function fetchAllMarketData(): Promise<{
    broker: BrokerPrice | null;
    bitkub: OrderBook | null;
    binanceTH: OrderBook | null;
    fx: FxRate | null;
}> {
    const [brokerResult, bitkubResult, binanceTHResult, fxResult] = await Promise.allSettled([
        fetchMaxbitPrice(),
        fetchBitkubOrderBook(),
        fetchBinanceTHOrderBook(),
        fetchFxRate(),
    ]);

    return {
        broker: brokerResult.status === 'fulfilled' ? brokerResult.value : null,
        bitkub: bitkubResult.status === 'fulfilled' ? bitkubResult.value : null,
        binanceTH: binanceTHResult.status === 'fulfilled' ? binanceTHResult.value : null,
        fx: fxResult.status === 'fulfilled' ? fxResult.value : null,
    };
}

/**
 * Format price for display
 */
export function formatPrice(price: number, decimals = 2): string {
    return price.toFixed(decimals);
}

/**
 * Calculate price difference between two exchanges
 */
export function calculatePriceDiff(
    price1: number,
    price2: number,
    exchange1: string,
    exchange2: string
): { diff: string; higher: string | null } {
    const difference = price1 - price2;
    const absDiff = Math.abs(difference);

    if (absDiff < 0.001) {
        return { diff: '0.00', higher: null };
    }

    return {
        diff: absDiff.toFixed(2),
        higher: difference > 0 ? exchange1 : exchange2,
    };
}
