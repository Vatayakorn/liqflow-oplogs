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

function getResolutionMinutes(hours: number): number {
    if (hours <= 24) return 1; // 1 min resolution for up to 24h
    if (hours <= 72) return 5; // Reduced resolution for 3 days to improve perf
    if (hours <= 168) return 15; // 15 min resolution for 1 week
    return 60;
}

/**
 * Stream market data in chunks to avoid memory limits and timeouts
 * @param source - Source name or array of sources
 * @param startTime - ISO start time
 * @param endTime - ISO end time (to bound the query)
 * @param onChunk - Callback function to process each chunk of data
 */
async function streamMarketData(
    source: string | string[],
    startTime: string,
    endTime: string,
    onChunk: (data: any[]) => void
): Promise<void> {
    let lastTime = startTime;
    let totalFetched = 0;
    const pageSize = 1000;
    const safetyLimit = 500000; // Limit to 500k records to prevent infinite loops

    console.log(`[Analytics] Streaming ${Array.isArray(source) ? source.join(', ') : source} from ${startTime.slice(0, 19)} to ${endTime.slice(0, 19)}`);

    while (totalFetched < safetyLimit) {
        // Fetch overlapping by 1ms to ensure we don't miss anything, but dedupe logic needed if strict
        // Using > lastTime to avoid infinite loop on duplicates is safer if we trust unique timestamps
        // But timestamps might not be unique.
        // Safer strategy: gte lastTime, and if we get same timestamp, we just rely on the fact that we might process it again? 
        // No, better to use strict paging if we had ID, but we only have created_at.
        // Let's stick to gte and filter if needed, or just accept tiny overlap. 
        // The original code used > lastTime logic by adding 1ms.

        let query = supabase
            .from('market_data')
            .select('created_at, source, price')
            .gte('created_at', lastTime)
            .lte('created_at', endTime)
            .order('created_at', { ascending: true })
            .limit(pageSize);

        if (Array.isArray(source)) {
            query = query.in('source', source);
        } else {
            query = query.eq('source', source);
        }

        const { data, error } = await query;

        if (error) {
            console.error(`[Analytics] Error streaming ${source}:`, error);
            break;
        }

        if (!data || data.length === 0) break;

        // Process this chunk
        onChunk(data);

        totalFetched += data.length;

        const lastRecord = data[data.length - 1];
        // Move time forward by 1ms to avoid duplicates (risk: missing data if multiple events on exactly same ms at boundary)
        // Given this is market data, 1ms granular enough? Yes usually.
        const nextTime = new Date(new Date(lastRecord.created_at).getTime() + 1).toISOString();

        if (nextTime === lastTime) {
            console.warn('[Analytics] Loop detected in pagination');
            break;
        }
        lastTime = nextTime;

        if (data.length < pageSize) break;
    }

    console.log(`[Analytics] Finished streaming ${totalFetched} records for ${Array.isArray(source) ? source.join(', ') : source}`);
}

/**
 * Fetch Spread Trend for the last N hours
 * Uses streaming to process large datasets
 */
export async function getSpreadTrend(hours = 6): Promise<SpreadDataPoint[]> {
    const endTime = new Date().toISOString();
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const resolution = getResolutionMinutes(hours);
    const resMs = resolution * 60 * 1000;

    const bucketMap = new Map<number, { bitkub: { sum: number, count: number }, binance: { sum: number, count: number } }>();

    const processChunk = (data: any[], type: 'bitkub' | 'binance') => {
        data.forEach(pt => {
            const ms = new Date(pt.created_at).getTime();
            const bucketTime = Math.floor(ms / resMs) * resMs;

            if (!bucketMap.has(bucketTime)) {
                bucketMap.set(bucketTime, {
                    bitkub: { sum: 0, count: 0 },
                    binance: { sum: 0, count: 0 }
                });
            }

            const bucket = bucketMap.get(bucketTime)!;
            bucket[type].sum += Number(pt.price);
            bucket[type].count += 1;
        });
    };

    // Stream both sources in parallel
    await Promise.all([
        streamMarketData('bitkub', startTime, endTime, (chunk) => processChunk(chunk, 'bitkub')),
        streamMarketData('binance_th', startTime, endTime, (chunk) => processChunk(chunk, 'binance'))
    ]);

    const result: SpreadDataPoint[] = [];
    const sortedBuckets = Array.from(bucketMap.keys()).sort((a, b) => a - b);

    let lastBk = 0;
    let lastBn = 0;

    sortedBuckets.forEach(time => {
        const v = bucketMap.get(time)!;

        const currentBk = v.bitkub.count > 0 ? v.bitkub.sum / v.bitkub.count : lastBk;
        const currentBn = v.binance.count > 0 ? v.binance.sum / v.binance.count : lastBn;

        if (currentBk > 0 && currentBn > 0) {
            result.push({
                time: Math.floor(time / 1000),
                bitkub: currentBk,
                binance: currentBn,
                spread: currentBk - currentBn,
                abs_spread: Math.abs(currentBk - currentBn)
            });
        }

        if (v.bitkub.count > 0) lastBk = currentBk;
        if (v.binance.count > 0) lastBn = currentBn;
    });

    return result;
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
        .limit(5000); // 5000 sessions is likely enough for history

    if (error) {
        console.error('Error fetching prefund history:', error);
        return [];
    }

    if (!data || data.length === 0) return [];

    return data.map(pt => ({
        time: Math.floor(new Date(pt.created_at).getTime() / 1000),
        current: Number(pt.prefund_current) || 0,
        target: Number(pt.prefund_target) || 0,
        date: pt.created_at
    }));
}

/**
 * Fetch Market Comparison for the last N hours
 * Uses streaming to process large datasets
 */
export async function getMarketComparison(hours = 6): Promise<MarketComparisonPoint[]> {
    const endTime = new Date().toISOString();
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const resolution = getResolutionMinutes(hours);
    const resMs = resolution * 60 * 1000;

    const sources = ['bitkub', 'binance_th', 'maxbit', 'fx', 'zcom', 'xspring', 'bitazza'];
    // Map of timestamp -> Map of source -> { sum, count }
    const bucketMap = new Map<number, Map<string, { sum: number, count: number }>>();

    const processChunk = (chunk: any[], sourceName: string) => {
        chunk.forEach(pt => {
            const ms = new Date(pt.created_at).getTime();
            const bucketTime = Math.floor(ms / resMs) * resMs;

            if (!bucketMap.has(bucketTime)) {
                bucketMap.set(bucketTime, new Map());
            }

            const bucket = bucketMap.get(bucketTime)!;
            if (!bucket.has(sourceName)) {
                bucket.set(sourceName, { sum: 0, count: 0 });
            }

            const stats = bucket.get(sourceName)!;
            stats.sum += Number(pt.price);
            stats.count += 1;
        });
    };

    // Parallel stream all sources
    await Promise.all(
        sources.map(source =>
            streamMarketData(source, startTime, endTime, (chunk) => processChunk(chunk, source))
        )
    );

    const result: MarketComparisonPoint[] = [];

    // Sort buckets by time
    const sortedTimes = Array.from(bucketMap.keys()).sort((a, b) => a - b);

    sortedTimes.forEach(time => {
        const sourceMap = bucketMap.get(time)!;
        sourceMap.forEach((stats, source) => {
            if (stats.count > 0) {
                result.push({
                    time: Math.floor(time / 1000),
                    source,
                    price: stats.sum / stats.count
                });
            }
        });
    });

    return result.sort((a, b) => a.time - b.time);
}
