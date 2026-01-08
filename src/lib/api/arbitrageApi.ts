/**
 * Arbitrage API Service
 * Fetches prices from multiple exchanges and calculates arbitrage opportunities
 */

// ==================== TYPES ====================

export interface GlobalPrice {
    bestBid: number;
    bestAsk: number;
    source: string;
    symbol: string; // Unified symbol (e.g., BTC, ETH)
    timestamp: Date;
}

export interface LocalPrice {
    bestBid: number;
    bestAsk: number;
    source: string;
    symbol: string; // Unified symbol (e.g., BTC, ETH)
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

// Polling interval for real-time updates (milliseconds)
export const POLLING_INTERVAL_MS = 3000;

// Profit threshold for "good" opportunities (percentage)
export const PROFIT_THRESHOLD_PERCENT = 0.5;

// API Endpoints
const ENDPOINTS = {
    binanceGlobal: 'https://api.binance.com/api/v3/ticker/bookTicker',
    bybit: 'https://api.bybit.com/v5/market/tickers',
    bitkub: {
        ticker: 'https://api.bitkub.com/api/v3/market/ticker', // V3 returns array
    },
    binanceTH: {
        bookTicker: 'https://api.binance.th/api/v1/ticker/bookTicker',
    },
};

// ==================== SYMBOL NORMALIZATION ====================

// Map Bitkub specific symbols to standard symbols if they usually differ (beyond prefix)
// Bitkub V3 keys are like 'BTC_THB', 'ETH_THB'
const BITKUB_OVERRIDES: Record<string, string> = {
    'LUNA': 'LUNC',  // Bitkub LUNA is actually Terra Classic (LUNC)
    'LUNA2': 'LUNA', // Bitkub LUNA2 is actually Terra 2.0 (LUNA)
    'GALA1': 'GALA',
    'VELO': 'VELODROME', // Bitkub VELO is actually Velodrome
};

const SYMBOL_ALIASES: Record<string, string> = {
    'GAL': 'GALEON', // Generic alias if needed across exchanges
    'USDTTHB': 'USDT', // For BinanceTH consistency
};

function normalizeSymbol(rawSymbol: string, exchange: 'Bitkub' | 'BinanceTH' | 'Global'): string | null {
    let symbol = rawSymbol;

    if (exchange === 'Bitkub') {
        if (symbol.endsWith('_THB')) {
            symbol = symbol.replace('_THB', '');
        } else if (symbol.startsWith('THB_')) { // Fallback for V1 just in case
            symbol = symbol.replace('THB_', '');
        } else {
            return null; // Ignore non-THB pairs
        }

        // Apply Bitkub specific overrides
        if (BITKUB_OVERRIDES[symbol]) {
            symbol = BITKUB_OVERRIDES[symbol];
        }
    } else if (exchange === 'BinanceTH') {
        if (symbol.endsWith('THB') && symbol !== 'USDTTHB') { // Ignore USDTTHB as it's FX
            symbol = symbol.replace('THB', '');
        } else {
            return null; // Ignore non-THB pairs
        }
    } else if (exchange === 'Global') {
        if (symbol.endsWith('USDT')) {
            symbol = symbol.replace('USDT', '');
        } else {
            return null; // Ignore non-USDT pairs
        }
    }

    return SYMBOL_ALIASES[symbol] || symbol;
}

// ==================== FX RATE ====================

/**
 * Fetch USDT/THB mid rate from BinanceTH
 */
export async function fetchBinanceTHFxMid(): Promise<FxData> {
    try {
        // We can fetch this from the bulk call too, but keeping it separate for clarity/reliability ensures we always have FX
        const response = await fetch(`${ENDPOINTS.binanceTH.bookTicker}?symbol=USDTTHB`);
        const data = await response.json();

        // data is object for single symbol or array for bulk?
        // ?symbol=USDTTHB returns object according to binance docs, but let's handle both
        const ticker = Array.isArray(data) ? data[0] : data;

        const bestBid = parseFloat(ticker.bidPrice);
        const bestAsk = parseFloat(ticker.askPrice);
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
        // Fallback to approximate rate if fails (rare)
        return {
            mid: 34.0,
            bid: 33.9,
            ask: 34.1,
            source: 'FixedFallback',
            timestamp: new Date(),
        };
    }
}

// ==================== BULK FETCHERS ====================

/**
 * Fetch all prices from Bitkub
 */
async function fetchAllBitkubTickers(): Promise<LocalPrice[]> {
    try {
        const response = await fetch(ENDPOINTS.bitkub.ticker);
        if (!response.ok) throw new Error('Bitkub API failed');
        const data = await response.json();
        // V3 data is an array: [{ symbol: 'BTC_THB', highest_bid: '123', lowest_ask: '124', ... }]

        const prices: LocalPrice[] = [];
        for (const ticker of data) {
            const sym = normalizeSymbol(ticker.symbol, 'Bitkub');
            const bid = parseFloat(ticker.highest_bid);
            const ask = parseFloat(ticker.lowest_ask);

            if (sym && bid > 0 && ask > 0) {
                prices.push({
                    source: 'Bitkub',
                    symbol: sym,
                    bestBid: bid,
                    bestAsk: ask,
                    timestamp: new Date()
                });
            }
        }
        return prices;
    } catch (e) {
        console.error('Error fetching Bitkub tickers:', e);
        return [];
    }
}

/**
 * Fetch all prices from BinanceTH
 */
async function fetchAllBinanceTHTickers(): Promise<LocalPrice[]> {
    try {
        const response = await fetch(ENDPOINTS.binanceTH.bookTicker);
        if (!response.ok) throw new Error('BinanceTH API failed');
        const data = await response.json();

        const prices: LocalPrice[] = [];
        for (const ticker of data) {
            const sym = normalizeSymbol(ticker.symbol, 'BinanceTH');
            if (sym) {
                prices.push({
                    source: 'BinanceTH',
                    symbol: sym,
                    bestBid: parseFloat(ticker.bidPrice),
                    bestAsk: parseFloat(ticker.askPrice),
                    timestamp: new Date()
                });
            }
        }
        return prices;
    } catch (e) {
        console.error('Error fetching BinanceTH tickers:', e);
        return [];
    }
}

/**
 * Fetch all prices from Binance Global
 */
async function fetchAllBinanceGlobalTickers(): Promise<GlobalPrice[]> {
    try {
        const response = await fetch(ENDPOINTS.binanceGlobal);
        if (!response.ok) throw new Error('Binance Global API failed');
        const data = await response.json();

        const prices: GlobalPrice[] = [];
        for (const ticker of data) {
            const sym = normalizeSymbol(ticker.symbol, 'Global');
            if (sym) {
                prices.push({
                    source: 'Binance',
                    symbol: sym,
                    bestBid: parseFloat(ticker.bidPrice),
                    bestAsk: parseFloat(ticker.askPrice),
                    timestamp: new Date()
                });
            }
        }
        return prices;
    } catch (e) {
        console.error('Error fetching Binance Global tickers:', e);
        return [];
    }
}

/**
 * Fetch all prices from Bybit
 */
async function fetchAllBybitTickers(): Promise<GlobalPrice[]> {
    try {
        // Bybit tickers endpoint might not return ALL spots in one go without pagination or proper category
        // But 'spot' category usually returns most.
        const response = await fetch(`${ENDPOINTS.bybit}?category=spot`);
        if (!response.ok) throw new Error('Bybit API failed');
        const data = await response.json();

        if (data.retCode !== 0) throw new Error(data.retMsg);

        const prices: GlobalPrice[] = [];
        for (const ticker of data.result.list) {
            const sym = normalizeSymbol(ticker.symbol, 'Global');
            if (sym) {
                prices.push({
                    source: 'Bybit',
                    symbol: sym,
                    bestBid: parseFloat(ticker.bid1Price),
                    bestAsk: parseFloat(ticker.ask1Price),
                    timestamp: new Date()
                });
            }
        }
        return prices;
    } catch (e) {
        console.error('Error fetching Bybit tickers:', e);
        return [];
    }
}

// ==================== ARBITRAGE CALCULATIONS ====================

function calculateCase1(
    globalPrice: GlobalPrice,
    localPrice: LocalPrice,
    fx: number
): ArbitrageOpportunity {
    const costTHB = globalPrice.bestAsk * fx;
    const profitTHB = localPrice.bestBid - costTHB;
    const profitPercent = (profitTHB / costTHB) * 100;

    return {
        id: `c1-${globalPrice.source}-${localPrice.source}-${localPrice.symbol}`,
        coin: localPrice.symbol,
        case: 1,
        caseLabel: 'Buy Global → Sell Local',
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

function calculateCase2(
    localPrice: LocalPrice,
    globalPrice: GlobalPrice,
    fx: number
): ArbitrageOpportunity {
    const costUSDT = localPrice.bestAsk / fx;
    const profitUSDT = globalPrice.bestBid - costUSDT;
    const profitPercent = (profitUSDT / costUSDT) * 100;

    return {
        id: `c2-${localPrice.source}-${globalPrice.source}-${localPrice.symbol}`,
        coin: localPrice.symbol,
        case: 2,
        caseLabel: 'Buy Local → Sell Global',
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

function calculateCase3(
    buyFromLocal: LocalPrice,
    sellToLocal: LocalPrice
): ArbitrageOpportunity {
    const profitTHB = sellToLocal.bestBid - buyFromLocal.bestAsk;
    const profitPercent = (profitTHB / buyFromLocal.bestAsk) * 100;

    return {
        id: `c3-${buyFromLocal.source}-${sellToLocal.source}-${buyFromLocal.symbol}`,
        coin: buyFromLocal.symbol,
        case: 3,
        caseLabel: 'Local Pingpong',
        buyFrom: buyFromLocal.source,
        sellTo: sellToLocal.source,
        buyPrice: buyFromLocal.bestAsk,
        sellPrice: sellToLocal.bestBid,
        fxRate: 0,
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
 * Fetch all arbitrage opportunities for all coins (bulk mode)
 */
export async function fetchAllArbitrageOpportunities(
    // coins argument is officially ignored now as we prefer bulk, 
    // but kept in signature if needed for backward compatibility or strict filtering later
    filterCoins?: string[]
): Promise<{ opportunities: ArbitrageOpportunity[]; fx: FxData }> {

    // 1. Fetch EVERYTHING concurrently
    const [fx, bitkubPrices, binanceTHPrices, binanceGlobalPrices, bybitPrices] = await Promise.all([
        fetchBinanceTHFxMid(),
        fetchAllBitkubTickers(),
        fetchAllBinanceTHTickers(),
        fetchAllBinanceGlobalTickers(),
        fetchAllBybitTickers()
    ]);

    const opportunities: ArbitrageOpportunity[] = [];

    // 2. Index prices by symbol for O(1) lookup
    const localMap: Record<string, LocalPrice[]> = {};
    const globalMap: Record<string, GlobalPrice[]> = {};

    [...bitkubPrices, ...binanceTHPrices].forEach(p => {
        if (!localMap[p.symbol]) localMap[p.symbol] = [];
        localMap[p.symbol].push(p);
    });

    [...binanceGlobalPrices, ...bybitPrices].forEach(p => {
        if (!globalMap[p.symbol]) globalMap[p.symbol] = [];
        globalMap[p.symbol].push(p);
    });

    // 3. Find Union of all relevant coins (must be present locally to do anything useful with local arb)
    // Actually, we iterate over 'localMap' keys because we need at least one local side for any arbitrage case involving THB
    const coins = Object.keys(localMap);

    // console.log(`[Arbitrage] Found ${coins.length} local coins. Sample:`, coins.slice(0, 5));

    for (const coin of coins) {
        // Optional filtering if provided
        if (filterCoins && filterCoins.length > 0 && !filterCoins.includes(coin)) continue;

        const locals = localMap[coin] || [];
        const globals = globalMap[coin] || [];

        // Case 1 & 2: Local <-> Global
        if (locals.length > 0 && globals.length > 0) {
            for (const loc of locals) {
                for (const glob of globals) {
                    if (loc.bestBid > 0 && glob.bestAsk > 0) {
                        opportunities.push(calculateCase1(glob, loc, fx.mid));
                    }
                    if (loc.bestAsk > 0 && glob.bestBid > 0) {
                        opportunities.push(calculateCase2(loc, glob, fx.mid));
                    }
                }
            }
        }

        // Case 3: Local <-> Local
        if (locals.length >= 2) {
            for (let i = 0; i < locals.length; i++) {
                for (let j = 0; j < locals.length; j++) {
                    if (i !== j) {
                        const buy = locals[i];
                        const sell = locals[j];
                        // prevent self-trade (same source) - though logic handles different sources
                        if (buy.source !== sell.source && buy.bestAsk > 0 && sell.bestBid > 0) {
                            opportunities.push(calculateCase3(buy, sell));
                        }
                    }
                }
            }
        }
    }

    // 4. Sort by profit high-to-low
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
        case1: case1.length > 0 ? case1[0] : null, // Already sorted
        case2: case2.length > 0 ? case2[0] : null,
        case3: case3.length > 0 ? case3[0] : null,
    };
}

// ==================== UTILITY FUNCTIONS ====================

export function formatProfit(profit: number, unit: 'THB' | 'USDT', decimals = 2): string {
    const sign = profit >= 0 ? '+' : '';
    const formatted = profit.toFixed(decimals);
    return `${sign}${formatted} ${unit}`;
}

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

export function updateDataAge(opportunities: ArbitrageOpportunity[]): ArbitrageOpportunity[] {
    const now = new Date();
    return opportunities.map(opp => ({
        ...opp,
        dataAge: Math.round((now.getTime() - opp.timestamp.getTime()) / 1000),
    }));
}
