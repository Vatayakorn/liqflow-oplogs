/**
 * Market Data API
 */
import { supabase } from '$lib/supabaseClient';

export interface MarketDataPoint {
    time: number; // Unix timestamp in seconds
    value: number;
    source: string;
}

/**
 * Fetch market data for a specific time range
 * Uses market_stats_1m view for consistent data (same as Analytics page)
 * @param startTime ISO string
 * @param endTime ISO string
 * @returns Array of market data points
 */
export async function getMarketDataRange(startTime: string, endTime: string): Promise<MarketDataPoint[]> {
    console.log(`Fetching market data from ${startTime} to ${endTime}`);

    // Use market_stats_1m view (aggregated 1-minute buckets) for consistent data
    // This matches what Analytics page uses via getMarketComparison()
    const { data, error } = await supabase
        .from('market_stats_1m')
        .select('bucket, avg_price, source')
        .gte('bucket', startTime)
        .lte('bucket', endTime)
        .order('bucket', { ascending: true });

    if (error) {
        console.error('Error fetching market data:', error);
        return [];
    }

    // Transform to lightweight-charts format
    // time must be in seconds
    // NOTE: Add local timezone offset so charts display local time (Lightweight Charts shows UTC by default)
    const timezoneOffsetSeconds = new Date().getTimezoneOffset() * -60;

    const rawData = data
        .filter(item => item.avg_price !== null && item.avg_price !== undefined)
        .map(item => ({
            time: Math.floor(new Date(item.bucket).getTime() / 1000) + timezoneOffsetSeconds,
            value: Number(item.avg_price),
            source: item.source
        }));

    // Dedup by source and time
    const dedupedMap = new Map<string, MarketDataPoint>();

    rawData.forEach(pt => {
        const key = `${pt.source}-${pt.time}`;
        dedupedMap.set(key, pt);
    });

    return Array.from(dedupedMap.values()).sort((a, b) => a.time - b.time);
}
