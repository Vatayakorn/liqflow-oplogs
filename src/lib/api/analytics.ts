import { supabase } from '$lib/supabaseClient';

export interface SpreadDataPoint {
    time: number;
    bitkub: number;
    binance: number;
    spread: number;
    abs_spread: number;
}

export interface PrefundDataPoint {
    time: number;
    current: number;
    target: number;
    date: string;
}

export interface MarketComparisonPoint {
    time: number;
    source: string;
    price: number;
}

/**
 * Fetch Spread Trend for the last N hours
 * Queries market_data directly to avoid view timeout issues
 */
export async function getSpreadTrend(hours = 6): Promise<SpreadDataPoint[]> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('market_data')
        .select('created_at, source, price')
        .in('source', ['bitkub', 'binance_th'])
        .gte('created_at', startTime)
        .order('created_at', { ascending: true })
        .limit(2000);

    if (error) {
        console.error('Error fetching spread trend:', error);
        return [];
    }

    if (!data || data.length === 0) return [];

    // Group by minute bucket
    const bucketMap = new Map<string, { bitkub: number[], binance: number[] }>();

    data.forEach(pt => {
        const bucket = new Date(pt.created_at);
        bucket.setSeconds(0, 0);
        const key = bucket.toISOString();

        if (!bucketMap.has(key)) bucketMap.set(key, { bitkub: [], binance: [] });
        const entry = bucketMap.get(key)!;

        if (pt.source === 'bitkub') entry.bitkub.push(Number(pt.price));
        else if (pt.source === 'binance_th') entry.binance.push(Number(pt.price));
    });

    const tzOffset = new Date().getTimezoneOffset() * -60;
    const result: SpreadDataPoint[] = [];

    bucketMap.forEach((v, key) => {
        if (v.bitkub.length > 0 && v.binance.length > 0) {
            const avgBk = v.bitkub.reduce((a, b) => a + b, 0) / v.bitkub.length;
            const avgBn = v.binance.reduce((a, b) => a + b, 0) / v.binance.length;
            result.push({
                time: Math.floor(new Date(key).getTime() / 1000) + tzOffset,
                bitkub: avgBk, binance: avgBn,
                spread: avgBk - avgBn, abs_spread: Math.abs(avgBk - avgBn)
            });
        }
    });

    return result.sort((a, b) => a.time - b.time);
}

/**
 * Fetch Prefund History for the last N hours
 */
export async function getPrefundHistory(hours = 6): Promise<PrefundDataPoint[]> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('oplog_sessions')
        .select('created_at, prefund_current, prefund_target')
        .gte('created_at', startTime)
        .not('prefund_current', 'is', null)
        .order('created_at', { ascending: true })
        .limit(500);

    if (error) {
        console.error('Error fetching prefund history:', error);
        return [];
    }

    if (!data || data.length === 0) return [];

    const timezoneOffsetSeconds = new Date().getTimezoneOffset() * -60;

    return data.map(pt => ({
        time: Math.floor(new Date(pt.created_at).getTime() / 1000) + timezoneOffsetSeconds,
        current: Number(pt.prefund_current) || 0,
        target: Number(pt.prefund_target) || 0,
        date: pt.created_at
    }));
}

/**
 * Fetch Market Comparison for the last N hours
 * Queries market_data directly to avoid view timeout issues
 */
export async function getMarketComparison(hours = 6): Promise<MarketComparisonPoint[]> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('market_data')
        .select('created_at, source, price')
        .gte('created_at', startTime)
        .order('created_at', { ascending: true })
        .limit(2000);

    if (error) {
        console.error('Error fetching market comparison:', error);
        return [];
    }

    if (!data || data.length === 0) return [];

    // Group by minute bucket and source
    const bucketMap = new Map<string, Map<string, number[]>>();

    data.forEach(pt => {
        const bucket = new Date(pt.created_at);
        bucket.setSeconds(0, 0);
        const key = bucket.toISOString();

        if (!bucketMap.has(key)) bucketMap.set(key, new Map());
        const sourceMap = bucketMap.get(key)!;
        if (!sourceMap.has(pt.source)) sourceMap.set(pt.source, []);
        sourceMap.get(pt.source)!.push(Number(pt.price));
    });

    const tzOffset = new Date().getTimezoneOffset() * -60;
    const result: MarketComparisonPoint[] = [];

    bucketMap.forEach((sourceMap, key) => {
        sourceMap.forEach((prices, source) => {
            result.push({
                time: Math.floor(new Date(key).getTime() / 1000) + tzOffset,
                source, price: prices.reduce((a, b) => a + b, 0) / prices.length
            });
        });
    });

    return result.sort((a, b) => a.time - b.time);
}
