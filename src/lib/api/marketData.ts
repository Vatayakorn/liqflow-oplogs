/**
 * Market Data API Service
 * Fetches real-time prices from various exchanges
 */

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
}

export interface FxRate {
    rate: number;
    source: string;
    timestamp: Date;
}

/**
 * Fetch USD/THB FX rate
 */
export async function fetchFxRate(): Promise<FxRate> {
    try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await response.json();

        if (data.result !== 'success') {
            throw new Error('Failed to fetch FX rate');
        }

        return {
            rate: data.rates.THB,
            source: 'Open Exchange Rates',
            timestamp: new Date(),
        };
    } catch (error) {
        console.error('FX API error:', error);
        throw error;
    }
}

/**
 * Fetch BTZ (MaxBit) broker prices
 */
export async function fetchMaxbitPrice(symbol = 'usdt'): Promise<BrokerPrice> {
    try {
        const response = await fetch(ENDPOINTS.maxbit, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'secret-api': MAXBIT_CONFIG.secretApi,
                'secret-key': MAXBIT_CONFIG.secretKey,
            },
            body: JSON.stringify({
                groupid: MAXBIT_CONFIG.groupId,
                symbol,
            }),
        });

        const data = await response.json();

        if (data.responseCode !== '000') {
            throw new Error(data.responseMessage || 'Failed to fetch MaxBit price');
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
 * Fetch Bitkub order book
 */
export async function fetchBitkubOrderBook(symbol = 'THB_USDT', limit = 5): Promise<OrderBook> {
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
 * Fetch BinanceTH order book
 */
export async function fetchBinanceTHOrderBook(symbol = 'USDTTHB', limit = 5): Promise<OrderBook> {
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
}> {
    const [brokerResult, bitkubResult, binanceTHResult] = await Promise.allSettled([
        fetchMaxbitPrice(),
        fetchBitkubOrderBook(),
        fetchBinanceTHOrderBook(),
    ]);

    return {
        broker: brokerResult.status === 'fulfilled' ? brokerResult.value : null,
        bitkub: bitkubResult.status === 'fulfilled' ? bitkubResult.value : null,
        binanceTH: binanceTHResult.status === 'fulfilled' ? binanceTHResult.value : null,
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
