/**
 * Auto Save API - Fetch latest prices from market_data table
 * Used by SessionForm for auto-save feature
 */

import { supabase } from '$lib/supabaseClient';

export interface LatestPrices {
    fx: { rate: number; timestamp: string } | null;
    maxbit: { bid: number; ask: number; timestamp: string } | null;
    bitkub: { bid: number; ask: number; timestamp: string } | null;
    binanceTH: { bid: number; ask: number; timestamp: string } | null;
}

/**
 * Fetch the latest price from each data source in market_data table
 * Returns null for sources that have no recent data
 */
export async function fetchLatestMarketPrices(): Promise<LatestPrices> {
    const result: LatestPrices = {
        fx: null,
        maxbit: null,
        bitkub: null,
        binanceTH: null
    };

    // Query latest entry for each source
    const sources = ['fx', 'maxbit', 'bitkub', 'binance_th'] as const;

    for (const source of sources) {
        const { data, error } = await supabase
            .from('market_data')
            .select('price, bid, ask, created_at')
            .eq('source', source)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !data) continue;

        const timestamp = data.created_at;

        switch (source) {
            case 'fx':
                if (data.price) {
                    result.fx = {
                        rate: Number(data.price),
                        timestamp
                    };
                }
                break;
            case 'maxbit':
                if (data.bid && data.ask) {
                    result.maxbit = {
                        bid: Number(data.bid),
                        ask: Number(data.ask),
                        timestamp
                    };
                }
                break;
            case 'bitkub':
                if (data.bid && data.ask) {
                    result.bitkub = {
                        bid: Number(data.bid),
                        ask: Number(data.ask),
                        timestamp
                    };
                }
                break;
            case 'binance_th':
                if (data.bid && data.ask) {
                    result.binanceTH = {
                        bid: Number(data.bid),
                        ask: Number(data.ask),
                        timestamp
                    };
                }
                break;
        }
    }

    return result;
}
