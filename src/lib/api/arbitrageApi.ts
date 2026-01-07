/**
 * Arbitrage API Service
 * Fetches prices from multiple exchanges and calculates arbitrage opportunities
 */

// ==================== TYPES ====================

export interface GlobalPrice {
    bestBid: number;
    bestAsk: number;
    source: string;
    symbol: string;
    timestamp: Date;
}

export interface LocalPrice {
    bestBid: number;
    bestAsk: number;
    source: string;
    symbol: string;
    timestamp: Date;
}

export interface ArbitrageOpportunity {
    id: string;
    coin: string;
    case: 1 | 2 | 3;
    caseLabel: string;
    buyFrom: string;
    sellTo: string;
    buyPrice: number;
    sellPrice: number;
    fxRate: number;
    profit: number;
    profitPercent: number;
    profitUnit: 'THB' | 'USDT';
    timestamp: Date;
    dataAge: number; // seconds since last update
    isPositive: boolean;
}

export interface FxData {
    mid: number;
    bid: number;
    ask: number;
    source: string;
    timestamp: Date;
}

// ==================== CONSTANTS ====================

// Default coins to track (major coins available on both Bitkub and BinanceTH)
export const DEFAULT_COINS = ['BTC', 'ETH', 'XRP', 'BNB', 'SOL', 'DOGE', 'ADA', 'MATIC'];

// Polling interval for real-time updates (milliseconds)
export const POLLING_INTERVAL_MS = 3000;

// Profit threshold for "good" opportunities (percentage)
export const PROFIT_THRESHOLD_PERCENT = 0.5;

// API Endpoints
const ENDPOINTS = {
    binanceGlobal: 'https://api.binance.com/api/v3/ticker/bookTicker',
    bybit: 'https://api.bybit.com/v5/market/tickers',
    bitkub: {
        tickerV3: 'https://api.bitkub.com/api/v3/market/ticker',
    },
    binanceTH: {
        depth: 'https://api.binance.th/api/v1/depth',
    },
};

// ==================== SYMBOL MAPPING ====================

// Map standard symbols to Bitkub specific symbols if they differ
const BITKUB_SYMBOL_MAP: Record<string, string> = {
    'MATIC': 'POL', // Polygon migrated to POL on Bitkub
};

// ==================== FX RATE ====================

/**
 * Fetch USDT/THB mid rate from BinanceTH
 * FX = (Ask + Bid) / 2
 */
export async function fetchBinanceTHFxMid(): Promise<FxData> {
    try {
        const timestamp = new Date().getTime();
        const response = await fetch(`${ENDPOINTS.binanceTH.depth}?symbol=USDTTHB&limit=1&t=${timestamp}`);
        const data = await response.json();

        const bestBid = parseFloat(data.bids[0][0]);
        const bestAsk = parseFloat(data.asks[0][0]);
        const mid = (bestBid + bestAsk) / 2;

        return {
            mid,
            bid: bestBid,
            ask: bestAsk,
            source: 'BinanceTH',
            timestamp: new Date(),
        };
    } catch (error) {
        console.error('[ArbitrageAPI] Error fetching FX rate:', error);
        throw error;
    }
}

// ==================== GLOBAL EXCHANGE PRICES ====================

/**
 * Fetch price from Binance Global
 */
export async function fetchBinanceGlobalPrice(coin: string): Promise<GlobalPrice | null> {
    try {
        const symbol = `${coin}USDT`;
        const response = await fetch(`${ENDPOINTS.binanceGlobal}?symbol=${symbol}`);

        if (!response.ok) {
            console.warn(`[ArbitrageAPI] Binance Global: ${symbol} not found`);
            return null;
        }

        const data = await response.json();

        return {
            bestBid: parseFloat(data.bidPrice),
            bestAsk: parseFloat(data.askPrice),
            source: 'Binance',
            symbol: coin,
            timestamp: new Date(),
        };
    } catch (error) {
        console.error(`[ArbitrageAPI] Binance Global error for ${coin}:`, error);
        return null;
    }
}

/**
 * Fetch price from Bybit
 */
export async function fetchBybitPrice(coin: string): Promise<GlobalPrice | null> {
    try {
        const symbol = `${coin}USDT`;
        const response = await fetch(`${ENDPOINTS.bybit}?category=spot&symbol=${symbol}`);
        const data = await response.json();

        if (data.retCode !== 0 || !data.result?.list?.[0]) {
            console.warn(`[ArbitrageAPI] Bybit: ${symbol} not found`);
            return null;
        }

        const ticker = data.result.list[0];

        return {
            bestBid: parseFloat(ticker.bid1Price),
            bestAsk: parseFloat(ticker.ask1Price),
            source: 'Bybit',
            symbol: coin,
            timestamp: new Date(),
        };
    } catch (error) {
        console.error(`[ArbitrageAPI] Bybit error for ${coin}:`, error);
        return null;
    }
}

/**
 * Fetch all global prices for a coin (Binance + Bybit)
 */
export async function fetchAllGlobalPrices(coin: string): Promise<GlobalPrice[]> {
    const [binance, bybit] = await Promise.all([
        fetchBinanceGlobalPrice(coin),
        fetchBybitPrice(coin),
    ]);

    return [binance, bybit].filter((p): p is GlobalPrice => p !== null);
}

// ==================== LOCAL EXCHANGE PRICES ====================

/**
 * Fetch price from Bitkub
 */
export async function fetchBitkubPrice(coin: string): Promise<LocalPrice | null> {
    try {
        // Handle symbol mapping (e.g. MATIC -> POL)
        const targetCoin = BITKUB_SYMBOL_MAP[coin] || coin;

        // V3 API uses XXX_THB format (e.g., DOGE_THB)
        const symbol = `${targetCoin}_THB`;
        const response = await fetch(`${ENDPOINTS.bitkub.tickerV3}?sym=${symbol}`);

        if (!response.ok) {
            console.warn(`[ArbitrageAPI] Bitkub: ${symbol} not found`);
            return null;
        }

        const data = await response.json();

        // V3 returns an array of objects
        if (!Array.isArray(data) || data.length === 0) {
            return null;
        }

        const ticker = data[0];

        return {
            bestBid: parseFloat(ticker.highest_bid),
            bestAsk: parseFloat(ticker.lowest_ask),
            source: 'Bitkub',
            symbol: coin,
            timestamp: new Date(),
        };
    } catch (error) {
        console.error(`[ArbitrageAPI] Bitkub error for ${coin}:`, error);
        return null;
    }
}

/**
 * Fetch price from BinanceTH
 */
export async function fetchBinanceTHPrice(coin: string): Promise<LocalPrice | null> {
    try {
        const symbol = `${coin}THB`;
        const timestamp = new Date().getTime();
        const response = await fetch(`${ENDPOINTS.binanceTH.depth}?symbol=${symbol}&limit=1&t=${timestamp}`);

        if (!response.ok) {
            console.warn(`[ArbitrageAPI] BinanceTH: ${symbol} not found`);
            return null;
        }

        const data = await response.json();

        if (!data.bids?.length || !data.asks?.length) {
            return null;
        }

        return {
            bestBid: parseFloat(data.bids[0][0]),
            bestAsk: parseFloat(data.asks[0][0]),
            source: 'BinanceTH',
            symbol: coin,
            timestamp: new Date(),
        };
    } catch (error) {
        console.error(`[ArbitrageAPI] BinanceTH error for ${coin}:`, error);
        return null;
    }
}

/**
 * Fetch all local prices for a coin (Bitkub + BinanceTH)
 */
export async function fetchAllLocalPrices(coin: string): Promise<LocalPrice[]> {
    const [bitkub, binanceTH] = await Promise.all([
        fetchBitkubPrice(coin),
        fetchBinanceTHPrice(coin),
    ]);

    return [bitkub, binanceTH].filter((p): p is LocalPrice => p !== null);
}

// ==================== ARBITRAGE CALCULATIONS ====================

/**
 * Case 1: Buy Global → Sell Local (Profit in THB)
 * Cost1_THB = GlobalAsk_USDT × FX
 * Profit1_THB = LocalBid_THB − Cost1_THB
 * Profit1_% = (Profit1_THB / Cost1_THB) × 100
 */
function calculateCase1(
    globalPrice: GlobalPrice,
    localPrice: LocalPrice,
    fx: number
): ArbitrageOpportunity {
    const costTHB = globalPrice.bestAsk * fx;
    const profitTHB = localPrice.bestBid - costTHB;
    const profitPercent = (profitTHB / costTHB) * 100;

    return {
        id: `case1-${globalPrice.source}-${localPrice.source}-${localPrice.symbol}`,
        coin: localPrice.symbol,
        case: 1,
        caseLabel: 'Best Ask Global → Best Bid Local',
        buyFrom: globalPrice.source,
        sellTo: localPrice.source,
        buyPrice: globalPrice.bestAsk,
        sellPrice: localPrice.bestBid,
        fxRate: fx,
        profit: profitTHB,
        profitPercent,
        profitUnit: 'THB',
        timestamp: new Date(),
        dataAge: 0,
        isPositive: profitTHB > 0,
    };
}

/**
 * Case 2: Buy Local → Sell Global (Profit in USDT)
 * Cost2_USDT = LocalAsk_THB / FX
 * Profit2_USDT = GlobalBid_USDT − Cost2_USDT
 * Profit2_% = (Profit2_USDT / Cost2_USDT) × 100
 */
function calculateCase2(
    localPrice: LocalPrice,
    globalPrice: GlobalPrice,
    fx: number
): ArbitrageOpportunity {
    const costUSDT = localPrice.bestAsk / fx;
    const profitUSDT = globalPrice.bestBid - costUSDT;
    const profitPercent = (profitUSDT / costUSDT) * 100;

    return {
        id: `case2-${localPrice.source}-${globalPrice.source}-${localPrice.symbol}`,
        coin: localPrice.symbol,
        case: 2,
        caseLabel: 'Best Ask Local → Best Bid Global',
        buyFrom: localPrice.source,
        sellTo: globalPrice.source,
        buyPrice: localPrice.bestAsk,
        sellPrice: globalPrice.bestBid,
        fxRate: fx,
        profit: profitUSDT,
        profitPercent,
        profitUnit: 'USDT',
        timestamp: new Date(),
        dataAge: 0,
        isPositive: profitUSDT > 0,
    };
}

/**
 * Case 3: Buy Local → Sell Local (Pingpong) (Profit in THB)
 * Profit3_THB = LocalBid_THB (from sellTo) − LocalAsk_THB (from buyFrom)
 * Profit3_% = (Profit3_THB / LocalAsk_THB) × 100
 */
function calculateCase3(
    buyFromLocal: LocalPrice,
    sellToLocal: LocalPrice
): ArbitrageOpportunity {
    const profitTHB = sellToLocal.bestBid - buyFromLocal.bestAsk;
    const profitPercent = (profitTHB / buyFromLocal.bestAsk) * 100;

    return {
        id: `case3-${buyFromLocal.source}-${sellToLocal.source}-${buyFromLocal.symbol}`,
        coin: buyFromLocal.symbol,
        case: 3,
        caseLabel: 'Local Pingpong',
        buyFrom: buyFromLocal.source,
        sellTo: sellToLocal.source,
        buyPrice: buyFromLocal.bestAsk,
        sellPrice: sellToLocal.bestBid,
        fxRate: 0, // Not used for Case 3
        profit: profitTHB,
        profitPercent,
        profitUnit: 'THB',
        timestamp: new Date(),
        dataAge: 0,
        isPositive: profitTHB > 0,
    };
}

// ==================== MAIN AGGREGATOR ====================

/**
 * Fetch all arbitrage opportunities for given coins
 */
export async function fetchAllArbitrageOpportunities(
    coins: string[] = DEFAULT_COINS
): Promise<{ opportunities: ArbitrageOpportunity[]; fx: FxData }> {
    // 1. Fetch FX rate first
    const fx = await fetchBinanceTHFxMid();

    // 2. Fetch all prices concurrently
    const pricePromises = coins.map(async (coin) => {
        const [globalPrices, localPrices] = await Promise.all([
            fetchAllGlobalPrices(coin),
            fetchAllLocalPrices(coin),
        ]);
        return { coin, globalPrices, localPrices };
    });

    const allPrices = await Promise.all(pricePromises);

    // 3. Calculate all opportunities
    const opportunities: ArbitrageOpportunity[] = [];

    for (const { coin, globalPrices, localPrices } of allPrices) {
        // Case 1: For each global + local combination
        for (const globalPrice of globalPrices) {
            for (const localPrice of localPrices) {
                opportunities.push(calculateCase1(globalPrice, localPrice, fx.mid));
            }
        }

        // Case 2: For each local + global combination
        for (const localPrice of localPrices) {
            for (const globalPrice of globalPrices) {
                opportunities.push(calculateCase2(localPrice, globalPrice, fx.mid));
            }
        }

        // Case 3: For each local + local combination (excluding same source)
        for (let i = 0; i < localPrices.length; i++) {
            for (let j = 0; j < localPrices.length; j++) {
                if (i !== j) {
                    opportunities.push(calculateCase3(localPrices[i], localPrices[j]));
                }
            }
        }
    }

    // 4. Sort by profit percentage (descending)
    opportunities.sort((a, b) => b.profitPercent - a.profitPercent);

    return { opportunities, fx };
}

/**
 * Get best opportunity for each case
 */
export function getBestOpportunities(opportunities: ArbitrageOpportunity[]): {
    case1: ArbitrageOpportunity | null;
    case2: ArbitrageOpportunity | null;
    case3: ArbitrageOpportunity | null;
} {
    const case1 = opportunities.filter(o => o.case === 1);
    const case2 = opportunities.filter(o => o.case === 2);
    const case3 = opportunities.filter(o => o.case === 3);

    return {
        case1: case1.length > 0 ? case1.reduce((a, b) => a.profitPercent > b.profitPercent ? a : b) : null,
        case2: case2.length > 0 ? case2.reduce((a, b) => a.profitPercent > b.profitPercent ? a : b) : null,
        case3: case3.length > 0 ? case3.reduce((a, b) => a.profitPercent > b.profitPercent ? a : b) : null,
    };
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Format profit for display
 */
export function formatProfit(profit: number, unit: 'THB' | 'USDT', decimals = 2): string {
    const sign = profit >= 0 ? '+' : '';
    const formatted = profit.toFixed(decimals);
    return `${sign}${formatted} ${unit}`;
}

/**
 * Format percentage for display
 */
export function formatPercent(percent: number, decimals = 2): string {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(decimals)}%`;
}

/**
 * Check if opportunity passes profit threshold
 */
export function isGoodOpportunity(opportunity: ArbitrageOpportunity, threshold = PROFIT_THRESHOLD_PERCENT): boolean {
    return opportunity.profitPercent >= threshold;
}

/**
 * Update data age for opportunities
 */
export function updateDataAge(opportunities: ArbitrageOpportunity[]): ArbitrageOpportunity[] {
    const now = new Date();
    return opportunities.map(opp => ({
        ...opp,
        dataAge: Math.round((now.getTime() - opp.timestamp.getTime()) / 1000),
    }));
}
