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
 * @param startTime ISO string
 * @param endTime ISO string
 * @returns Array of market data points
 */
export async function getMarketDataRange(startTime: string, endTime: string): Promise<MarketDataPoint[]> {
    console.log(`Fetching market data from ${startTime} to ${endTime}`);

    const { data, error } = await supabase
        .from('market_data')
        .select('created_at, price, source')
        .gte('created_at', startTime)
        .lte('created_at', endTime)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching market data:', error);
        return [];
    }

    // Transform to lightweight-charts format
    // time must be in seconds
    // Transform and filter nulls
    // NOTE: Add local timezone offset so charts display local time (Lightweight Charts shows UTC by default)
    const timezoneOffsetSeconds = new Date().getTimezoneOffset() * -60; // Convert minutes to seconds, negate because getTimezoneOffset returns opposite

    const rawData = data
        .filter(item => item.price !== null && item.price !== undefined)
        .map(item => ({
            time: Math.floor(new Date(item.created_at).getTime() / 1000) + timezoneOffsetSeconds,
            value: Number(item.price),
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
