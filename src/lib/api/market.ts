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
 * Queries market_data table directly to avoid VIEW timeout issues
 * @param startTime ISO string
 * @param endTime ISO string
 * @returns Array of market data points
 */
export async function getMarketDataRange(startTime: string, endTime: string): Promise<MarketDataPoint[]> {
    console.log(`Fetching market data from ${startTime} to ${endTime}`);

    // Query market_data table directly (not the view which can timeout)
    // Use created_at for filtering and limit to avoid huge result sets
    const { data, error } = await supabase
        .from('market_data')
        .select('created_at, price, source')
        .gte('created_at', startTime)
        .lte('created_at', endTime)
        .not('price', 'is', null)
        .order('created_at', { ascending: true })
        .limit(10000);

    if (error) {
        console.error('Error fetching market data:', error);
        return [];
    }

    console.log(`Fetched ${data?.length || 0} raw market data points`);

    // Transform to lightweight-charts format
    // time must be in seconds
    // NOTE: Add local timezone offset so charts display local time (Lightweight Charts shows UTC by default)
    const timezoneOffsetSeconds = new Date().getTimezoneOffset() * -60;

    // Downsample to 1-minute buckets to reduce data points
    const bucketedData = new Map<string, { time: number; value: number; source: string; count: number }>();

    (data || []).forEach(item => {
        const timestamp = new Date(item.created_at);
        // Round to minute
        timestamp.setSeconds(0, 0);
        const bucketTime = Math.floor(timestamp.getTime() / 1000) + timezoneOffsetSeconds;
        const key = `${item.source}-${bucketTime}`;

        const existing = bucketedData.get(key);
        if (existing) {
            // Average the prices
            existing.value = (existing.value * existing.count + Number(item.price)) / (existing.count + 1);
            existing.count++;
        } else {
            bucketedData.set(key, {
                time: bucketTime,
                value: Number(item.price),
                source: item.source,
                count: 1
            });
        }
    });

    const result = Array.from(bucketedData.values())
        .map(({ time, value, source }) => ({ time, value, source }))
        .sort((a, b) => a.time - b.time);

    console.log(`Aggregated to ${result.length} data points`);
    return result;
}
