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

/**
 * Fetch Spread Trend for the last N hours
 */
export async function getSpreadTrend(hours = 24): Promise<SpreadDataPoint[]> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('spread_trend_1m')
        .select('*')
        .gte('bucket', startTime)
        .order('bucket', { ascending: true });

    if (error) {
        console.error('Error fetching spread trend:', error);
        return [];
    }

    const timezoneOffsetSeconds = new Date().getTimezoneOffset() * -60;

    return data.map(pt => ({
        time: Math.floor(new Date(pt.bucket).getTime() / 1000) + timezoneOffsetSeconds,
        bitkub: Number(pt.bitkub_price),
        binance: Number(pt.binance_price),
        spread: Number(pt.spread),
        abs_spread: Number(pt.abs_spread)
    }));
}

/**
 * Fetch Prefund History for the last N days
 */
export async function getPrefundHistory(days = 7): Promise<PrefundDataPoint[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('prefund_history_daily')
        .select('*')
        .gte('log_date', startDate)
        .order('log_date', { ascending: true });

    if (error) {
        console.error('Error fetching prefund history:', error);
        return [];
    }

    const timezoneOffsetSeconds = new Date().getTimezoneOffset() * -60;

    return data.map(pt => ({
        time: Math.floor(new Date(pt.log_date).getTime() / 1000) + timezoneOffsetSeconds,
        current: Number(pt.avg_current),
        target: Number(pt.avg_target),
        date: pt.log_date
    }));
}
