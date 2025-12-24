/**
 * Spread Tracking API
 * CRUD operations for referrers and spread records
 */

import { supabase } from '$lib/supabaseClient';

// ============================================
// Types
// ============================================

export interface ReferrerConfig {
    id: string;
    referrer_name: string;
    bitazza_fee: number;
    profit_share: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface SpreadRecord {
    id: string;
    session_id: string | null;
    transaction_id: string;
    referrer_name: string;
    customer_name: string;
    action: 'BUY' | 'SELL';
    amount: number;
    op_spread: string;
    exchange_bid: number;
    exchange_ask: number;
    customer_rate: number;
    real_spread: number;
    bitazza_deduct: number;
    net_profit: number;
    referrer_payout: number;
    created_at: string;
}

export interface CreateSpreadRecordPayload {
    session_id?: string;
    transaction_id: string;
    referrer_name: string;
    customer_name: string;
    action: 'BUY' | 'SELL';
    amount: number;
    op_spread: string;
    exchange_bid: number;
    exchange_ask: number;
    customer_rate: number;
}

export interface PayoutSummary {
    referrer_name: string;
    total_transactions: number;
    total_volume: number;
    total_net_profit: number;
    total_payout: number;
}

// ============================================
// Calculation Functions
// ============================================

/**
 * Calculate spread and payout for a transaction
 * 
 * SELL: Customer sells USDT → Operation buys from customer, sells on exchange
 *       real_spread = exchange_bid - customer_rate
 * 
 * BUY:  Customer buys USDT → Operation buys from exchange, sells to customer
 *       real_spread = customer_rate - exchange_ask
 */
export function calculateSpread(params: {
    action: 'BUY' | 'SELL';
    exchangeBid: number;
    exchangeAsk: number;
    customerRate: number;
    amount: number;
    bitazzaFee: number;
    profitShare: number;
}): {
    realSpread: number;
    netSpreadPerUnit: number;
    netProfit: number;
    referrerPayout: number;
} {
    const { action, exchangeBid, exchangeAsk, customerRate, amount, bitazzaFee, profitShare } = params;

    // Calculate real spread per USDT
    const realSpread = action === 'SELL'
        ? exchangeBid - customerRate
        : customerRate - exchangeAsk;

    // Deduct Bitazza fee
    const netSpreadPerUnit = realSpread - bitazzaFee;

    // Total profit
    const netProfit = netSpreadPerUnit * amount;

    // Referrer's share
    const referrerPayout = netProfit > 0 ? netProfit * profitShare : 0;

    return { realSpread, netSpreadPerUnit, netProfit, referrerPayout };
}

// ============================================
// Referrer Config CRUD
// ============================================

export async function listReferrers(): Promise<ReferrerConfig[]> {
    const { data, error } = await supabase
        .from('referrer_config')
        .select('*')
        .order('referrer_name');

    if (error) throw error;
    return data || [];
}

export async function getReferrer(name: string): Promise<ReferrerConfig | null> {
    const { data, error } = await supabase
        .from('referrer_config')
        .select('*')
        .eq('referrer_name', name)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
}

export async function createReferrer(
    referrerName: string,
    bitazzaFee = 0.01,
    profitShare = 0.5
): Promise<ReferrerConfig> {
    const { data, error } = await supabase
        .from('referrer_config')
        .insert({
            referrer_name: referrerName,
            bitazza_fee: bitazzaFee,
            profit_share: profitShare,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateReferrer(
    id: string,
    updates: Partial<Pick<ReferrerConfig, 'bitazza_fee' | 'profit_share' | 'is_active'>>
): Promise<ReferrerConfig> {
    const { data, error } = await supabase
        .from('referrer_config')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteReferrer(id: string): Promise<void> {
    const { error } = await supabase
        .from('referrer_config')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

// ============================================
// Spread Records CRUD
// ============================================

export async function createSpreadRecord(
    payload: CreateSpreadRecordPayload
): Promise<SpreadRecord> {
    // Get referrer config for fee and share
    const referrer = await getReferrer(payload.referrer_name);
    const bitazzaFee = referrer?.bitazza_fee ?? 0.01;
    const profitShare = referrer?.profit_share ?? 0.5;

    // Calculate spread
    const calc = calculateSpread({
        action: payload.action,
        exchangeBid: payload.exchange_bid,
        exchangeAsk: payload.exchange_ask,
        customerRate: payload.customer_rate,
        amount: payload.amount,
        bitazzaFee,
        profitShare,
    });

    const { data, error } = await supabase
        .from('spread_records')
        .insert({
            session_id: payload.session_id || null,
            transaction_id: payload.transaction_id,
            referrer_name: payload.referrer_name,
            customer_name: payload.customer_name,
            action: payload.action,
            amount: payload.amount,
            op_spread: payload.op_spread,
            exchange_bid: payload.exchange_bid,
            exchange_ask: payload.exchange_ask,
            customer_rate: payload.customer_rate,
            real_spread: calc.realSpread,
            bitazza_deduct: bitazzaFee,
            net_profit: calc.netProfit,
            referrer_payout: calc.referrerPayout,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function listSpreadRecords(filters?: {
    referrer?: string;
    sessionId?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
}): Promise<SpreadRecord[]> {
    let query = supabase
        .from('spread_records')
        .select('*')
        .order('created_at', { ascending: false });

    if (filters?.referrer) {
        query = query.eq('referrer_name', filters.referrer);
    }
    if (filters?.sessionId) {
        query = query.eq('session_id', filters.sessionId);
    }
    if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
    }
    if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
    }
    if (filters?.limit) {
        query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

export async function getSpreadRecordByTransaction(transactionId: string): Promise<SpreadRecord | null> {
    const { data, error } = await supabase
        .from('spread_records')
        .select('*')
        .eq('transaction_id', transactionId)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
}

export async function deleteSpreadRecord(id: string): Promise<void> {
    const { error } = await supabase
        .from('spread_records')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

// ============================================
// Payout Summary
// ============================================

export async function getPayoutSummary(filters?: {
    dateFrom?: string;
    dateTo?: string;
}): Promise<PayoutSummary[]> {
    let query = supabase
        .from('spread_records')
        .select('referrer_name, amount, net_profit, referrer_payout');

    if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
    }
    if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Aggregate by referrer
    const summaryMap = new Map<string, PayoutSummary>();

    (data || []).forEach(record => {
        const existing = summaryMap.get(record.referrer_name);
        if (existing) {
            existing.total_transactions += 1;
            existing.total_volume += record.amount;
            existing.total_net_profit += record.net_profit;
            existing.total_payout += record.referrer_payout;
        } else {
            summaryMap.set(record.referrer_name, {
                referrer_name: record.referrer_name,
                total_transactions: 1,
                total_volume: record.amount,
                total_net_profit: record.net_profit,
                total_payout: record.referrer_payout,
            });
        }
    });

    return Array.from(summaryMap.values()).sort((a, b) => b.total_payout - a.total_payout);
}

export async function getTotalPayout(filters?: {
    dateFrom?: string;
    dateTo?: string;
}): Promise<{ total: number; count: number }> {
    const summary = await getPayoutSummary(filters);
    return {
        total: summary.reduce((sum, s) => sum + s.total_payout, 0),
        count: summary.reduce((sum, s) => sum + s.total_transactions, 0),
    };
}
