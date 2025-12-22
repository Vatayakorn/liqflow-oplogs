/**
 * Market Feed Store - Supabase Realtime Price Streaming
 * Subscribes to market_data table and provides live price updates
 */

import { writable, derived, get } from 'svelte/store';
import { supabase, isSupabaseConfigured } from '$lib/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { OrderBook, BrokerPrice, FxRate, OrderBookEntry } from '$lib/api/marketData';

// Store State Interface
interface MarketFeedState {
    bitkub: OrderBook | null;
    binanceTH: OrderBook | null;
    maxbit: BrokerPrice | null;
    fx: FxRate | null;
    isConnected: boolean;
    lastUpdate: Date | null;
}

// Initial state
const initialState: MarketFeedState = {
    bitkub: null,
    binanceTH: null,
    maxbit: null,
    fx: null,
    isConnected: false,
    lastUpdate: null
};

// Create the writable store
const { subscribe, set, update } = writable<MarketFeedState>(initialState);

// Channel reference
let channel: RealtimeChannel | null = null;

/**
 * Parse order book data from database format
 */
function parseOrderBook(data: any, source: string): OrderBook | null {
    if (!data.order_book) return null;

    const bids: OrderBookEntry[] = (data.order_book.bids || []).slice(0, 5).map((b: any) => ({
        price: parseFloat(b[0]),
        amount: parseFloat(b[1])
    }));

    const asks: OrderBookEntry[] = (data.order_book.asks || []).slice(0, 5).map((a: any) => ({
        price: parseFloat(a[0]),
        amount: parseFloat(a[1])
    }));

    return {
        bids,
        asks,
        bestBid: bids[0]?.price || 0,
        bestAsk: asks[0]?.price || 0,
        source: `${source} (Live)`,
        timestamp: new Date(data.created_at)
    };
}

/**
 * Parse broker price from database format
 */
function parseBrokerPrice(data: any): BrokerPrice {
    return {
        bid: Number(data.bid),
        ask: Number(data.ask),
        source: 'BTZ (Live)',
        timestamp: new Date(data.created_at)
    };
}

/**
 * Parse FX rate from database format
 */
function parseFxRate(data: any): FxRate {
    return {
        rate: Number(data.price),
        source: 'FX (Live)',
        timestamp: new Date(data.created_at)
    };
}

/**
 * Connect to Supabase Realtime channel
 */
function connect(): void {
    if (!isSupabaseConfigured()) {
        console.warn('[MarketFeed] Supabase not configured, skipping realtime connection');
        return;
    }

    if (channel) {
        console.log('[MarketFeed] Already connected');
        return;
    }

    console.log('[MarketFeed] Connecting to realtime channel...');

    channel = supabase
        .channel('market_data_live')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'market_data'
            },
            (payload) => {
                console.log('[MarketFeed] Payload received:', payload);
                const data = payload.new as any;
                const source = data.source;

                if (!source) {
                    console.warn('[MarketFeed] Received payload without source:', data);
                    return;
                }

                update(state => {
                    const newState = { ...state, lastUpdate: new Date() };

                    switch (source) {
                        case 'bitkub':
                            const bitkubBook = parseOrderBook(data, 'Bitkub');
                            if (bitkubBook) newState.bitkub = bitkubBook;
                            break;

                        case 'binance_th':
                            const binanceBook = parseOrderBook(data, 'BinanceTH');
                            if (binanceBook) newState.binanceTH = binanceBook;
                            break;

                        case 'maxbit':
                            newState.maxbit = parseBrokerPrice(data);
                            break;

                        case 'fx':
                            newState.fx = parseFxRate(data);
                            break;
                    }

                    return newState;
                });
            }
        )
        .subscribe((status) => {
            console.log('[MarketFeed] Subscription status:', status);

            update(state => ({
                ...state,
                isConnected: status === 'SUBSCRIBED'
            }));
        });
}

/**
 * Disconnect from Supabase Realtime channel
 */
function disconnect(): void {
    if (channel) {
        console.log('[MarketFeed] Disconnecting from realtime channel...');
        supabase.removeChannel(channel);
        channel = null;

        update(state => ({
            ...state,
            isConnected: false
        }));
    }
}

/**
 * Reset store to initial state
 */
function reset(): void {
    disconnect();
    set(initialState);
}

// Derived stores for individual data sources
export const bitkubLive = derived({ subscribe }, $feed => $feed.bitkub);
export const binanceTHLive = derived({ subscribe }, $feed => $feed.binanceTH);
export const maxbitLive = derived({ subscribe }, $feed => $feed.maxbit);
export const fxLive = derived({ subscribe }, $feed => $feed.fx);
export const isConnected = derived({ subscribe }, $feed => $feed.isConnected);
export const lastUpdate = derived({ subscribe }, $feed => $feed.lastUpdate);

// Export the store with methods
export const marketFeed = {
    subscribe,
    connect,
    disconnect,
    reset
};
