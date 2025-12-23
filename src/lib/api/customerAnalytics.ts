/**
 * Customer Analytics API Module
 * ดึงและวิเคราะห์พฤติกรรมลูกค้าจาก chat และ OTC transactions
 */

import { supabase } from '$lib/supabaseClient';
import type { ChatMessage } from './chatlog';

// ============================================
// Types
// ============================================

export type BehaviorType =
    | 'hot_lead'
    | 'negotiator'
    | 'window_shopper'
    | 'ghost'
    | 'vip_repeat'
    | 'new_prospect';

export type Sentiment = 'positive' | 'neutral' | 'negative';
export type FollowupPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface CustomerAnalytics {
    id?: string;
    customer_name: string;
    display_name?: string;

    // Behavior
    behavior_type: BehaviorType;
    engagement_score: number;

    // Transaction Metrics
    total_transactions: number;
    total_volume: number;
    avg_transaction_size: number;
    last_transaction_date?: string;

    // Chat Metrics
    total_messages: number;
    first_contact?: string;
    last_contact?: string;
    avg_response_time_minutes?: number;

    // Quote Metrics (from confirmation detection)
    quote_count?: number;
    confirmation_count?: number;
    quote_to_cf_ratio?: number;
    avg_time_to_decision_minutes?: number;

    // AI Analysis
    sentiment: Sentiment;
    ai_summary?: string;
    recommendations: string[];
    risk_flags: string[];
    key_topics: string[];

    // Followup
    needs_followup: boolean;
    followup_reason?: string;
    followup_priority: FollowupPriority;
    last_followup_at?: string;

    // Metadata
    provider?: 'openai' | 'gemini';
    model?: string;
    analyzed_at?: string;
    created_at?: string;
    updated_at?: string;
}

export interface CustomerProfile {
    name: string;
    displayName: string;
    transactions: OtcTransactionSummary[];
    chatMessages: ChatMessage[];
    analytics?: CustomerAnalytics;
    quoteMetrics?: import('./confirmationDetector').CustomerQuoteMetrics;
}

export interface OtcTransactionSummary {
    id: string;
    date: string;
    action: 'BUY' | 'SELL';
    amount: number;
    currency: string;
    rate: number;
    session_id: string;
}

export interface BehaviorStats {
    hot_lead: number;
    negotiator: number;
    window_shopper: number;
    ghost: number;
    vip_repeat: number;
    new_prospect: number;
    total: number;
}

export interface CustomerListItem {
    name: string;
    displayName: string;
    behaviorType: BehaviorType;
    engagementScore: number;
    totalVolume: number;
    transactionCount: number;
    lastContact?: string;
    needsFollowup: boolean;
    followupPriority: FollowupPriority;
}

// ============================================
// Behavior Type Configuration
// ============================================

export const BEHAVIOR_CONFIG: Record<BehaviorType, {
    emoji: string;
    label: string;
    labelTh: string;
    color: string;
    action: string;
}> = {
    hot_lead: {
        emoji: '🔥',
        label: 'Hot Lead',
        labelTh: 'ลูกค้าศักยภาพสูง',
        color: '#ef4444',
        action: 'รักษาความสัมพันธ์ ให้ priority service'
    },
    negotiator: {
        emoji: '🎯',
        label: 'Negotiator',
        labelTh: 'กำลังต่อรอง',
        color: '#f59e0b',
        action: 'เสนอราคาที่ดีกว่า รอจังหวะปิดดีล'
    },
    window_shopper: {
        emoji: '👀',
        label: 'Window Shopper',
        labelTh: 'สอบถามข้อมูล',
        color: '#3b82f6',
        action: 'ให้ข้อมูลครบถ้วน สร้าง urgency'
    },
    ghost: {
        emoji: '😶',
        label: 'Ghost',
        labelTh: 'เงียบหายไป',
        color: '#6b7280',
        action: 'Follow up ภายใน 24-48 ชม.'
    },
    vip_repeat: {
        emoji: '💎',
        label: 'VIP Repeat',
        labelTh: 'ลูกค้าประจำ',
        color: '#8b5cf6',
        action: 'ให้ราคาพิเศษ priority service'
    },
    new_prospect: {
        emoji: '🆕',
        label: 'New Prospect',
        labelTh: 'ลูกค้าใหม่',
        color: '#22c55e',
        action: 'แนะนำบริการ ตอบคำถามละเอียด'
    }
};

// ============================================
// API Functions
// ============================================

/**
 * Get all unique customers from OTC transactions
 * Aggregates data from all sessions and merges with external Customer API
 */
export async function getAllCustomers(
    dateFrom?: string,
    dateTo?: string
): Promise<CustomerListItem[]> {
    // 1. Fetch from local Supabase (oplog_sessions)
    let query = supabase
        .from('oplog_sessions')
        .select(`
            id,
            otc_transactions,
            created_at,
            day:oplog_days!inner(log_date)
        `)
        .not('otc_transactions', 'is', null);

    // Apply date filter if provided
    if (dateFrom) {
        query = query.gte('oplog_days.log_date', dateFrom);
    }
    if (dateTo) {
        query = query.lte('oplog_days.log_date', dateTo);
    }

    const { data: sessions, error } = await query;

    if (error) {
        console.error('Error fetching sessions:', error);
    }

    // 2. Fetch from External API
    let apiCustomers: any[] = [];
    try {
        const { fetchAllCustomersFromAPI } = await import('./customerApi');
        apiCustomers = await fetchAllCustomersFromAPI();
        console.log(`[getAllCustomers] Found ${apiCustomers.length} customers in external API`);
    } catch (apiError) {
        console.warn('[getAllCustomers] Failed to fetch from external API:', apiError);
    }

    // 3. Fetch transactions from API (LF_API_BASE_URL) to enrich the count/volume
    let recentApiTransactions: any[] = [];
    try {
        const { fetchTodayOtcTransactions, fetchOtcTransactionsInRange } = await import('./otcApi');

        // If dateFrom is provided, fetch for that range. Otherwise just today.
        if (dateFrom) {
            recentApiTransactions = await fetchOtcTransactionsInRange(dateFrom, dateTo);
            console.log(`[getAllCustomers] Found ${recentApiTransactions.length} OTC transactions from API for range ${dateFrom} to ${dateTo || 'today'}`);
        } else {
            recentApiTransactions = await fetchTodayOtcTransactions();
            console.log(`[getAllCustomers] Found ${recentApiTransactions.length} OTC transactions from API for today`);
        }
    } catch (apiError) {
        console.warn('[getAllCustomers] Failed to fetch API transactions:', apiError);
    }

    // Aggregate customers from all sources
    const customerMap = new Map<string, {
        name: string;
        totalVolume: number;
        transactionCount: number;
        lastDate: string;
    }>();

    // Initialize with Master List
    apiCustomers.forEach(c => {
        const name = c.name?.trim();
        if (!name) return;
        customerMap.set(name.toLowerCase(), {
            name: name,
            totalVolume: 0,
            transactionCount: 0,
            lastDate: ''
        });
    });

    // Track matched transaction IDs to avoid double counting
    const processedTxIds = new Set<string>();

    // Merge session data
    sessions?.forEach(session => {
        const transactions = session.otc_transactions as any[] || [];
        const sessionDate = (session.day as any)?.log_date || session.created_at;

        transactions.forEach(tx => {
            const customerName = tx.customerName?.trim();
            if (!customerName) return;

            const txId = tx.id || `oplog-${session.id}-${tx.timestamp || sessionDate}`;
            processedTxIds.add(txId);

            const key = customerName.toLowerCase();
            const existing = customerMap.get(key);
            const amount = tx.amount || 0;

            if (existing) {
                existing.totalVolume += amount;
                existing.transactionCount += 1;
                if (sessionDate > existing.lastDate) existing.lastDate = sessionDate;
            } else {
                customerMap.set(key, {
                    name: customerName,
                    totalVolume: amount,
                    transactionCount: 1,
                    lastDate: sessionDate
                });
            }
        });
    });

    // Merge API transactions (fully deduplicated)
    recentApiTransactions.forEach(tx => {
        const customerName = tx.customerName?.trim();
        if (!customerName) return;

        // Skip if already processed in oplog sessions
        if (tx.id && processedTxIds.has(tx.id)) return;
        if (tx.id) processedTxIds.add(tx.id);

        const key = customerName.toLowerCase();
        const existing = customerMap.get(key);
        const amount = tx.amount || 0;
        const txDate = tx.timestamp || new Date().toISOString();

        if (existing) {
            existing.totalVolume += amount;
            existing.transactionCount += 1;
            if (txDate > existing.lastDate) existing.lastDate = txDate;
        } else {
            customerMap.set(key, {
                name: customerName,
                totalVolume: amount,
                transactionCount: 1,
                lastDate: txDate
            });
        }
    });

    // Get analytics for all customers
    const customerNames = Array.from(customerMap.values()).map(c => c.name);
    const { data: analyticsData } = await supabase
        .from('customer_analytics')
        .select('*')
        .in('customer_name', customerNames);

    const analyticsMap = new Map<string, CustomerAnalytics>();
    analyticsData?.forEach(a => analyticsMap.set(a.customer_name.toLowerCase(), a as CustomerAnalytics));

    // Build customer list
    const customers: CustomerListItem[] = [];

    customerMap.forEach((data, key) => {
        const analytics = analyticsMap.get(key);

        customers.push({
            name: data.name,
            displayName: analytics?.display_name || data.name,
            behaviorType: analytics?.behavior_type || 'new_prospect',
            engagementScore: analytics?.engagement_score || 0.5,
            totalVolume: data.totalVolume,
            transactionCount: data.transactionCount,
            lastContact: analytics?.last_contact || data.lastDate,
            needsFollowup: analytics?.needs_followup || false,
            followupPriority: analytics?.followup_priority || 'normal'
        });
    });

    // Sort by engagement score and volume
    customers.sort((a, b) => {
        if (a.needsFollowup !== b.needsFollowup) {
            return a.needsFollowup ? -1 : 1;
        }
        return b.engagementScore - a.engagementScore || b.totalVolume - a.totalVolume;
    });

    return customers;
}

/**
 * Get customer profile with full details
 * Fetches from both oplog_sessions AND the external Customer API
 */
export async function getCustomerProfile(customerName: string): Promise<CustomerProfile | null> {
    console.log('[CustomerProfile] Loading profile for:', customerName);

    // Import confirmation detector dynamically
    const { analyzeMessages, calculateCustomerMetrics } = await import('./confirmationDetector');

    // Fetch from both sources in parallel
    const [oplogTransactions, apiTransactions] = await Promise.all([
        fetchOplogTransactions(customerName),
        fetchCustomerApiTransactions(customerName)
    ]);

    // Merge transactions, preferring API data but deduplicating by ID
    const transactionMap = new Map<string, OtcTransactionSummary>();

    // Add oplog transactions first
    oplogTransactions.forEach(tx => {
        transactionMap.set(tx.id, tx);
    });

    // Add API transactions (may override duplicates)
    apiTransactions.forEach(tx => {
        transactionMap.set(tx.id, tx);
    });

    const transactions = Array.from(transactionMap.values()).sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        return timeB - timeA;
    });

    console.log(`[CustomerProfile] Merged transactions: ${transactions.length} (oplog: ${oplogTransactions.length}, api: ${apiTransactions.length})`);

    // Get chat messages that might be from this customer
    // Search by matching customerName with from_first_name or from_username
    // Unified fetching logic for both short and long names
    const searchName = customerName.trim();
    const namePattern = searchName.length <= 2 ? searchName : `%${searchName}%`;
    const botPattern = `%${searchName}%`;

    const { data: rawMessages, error: chatError } = await supabase
        .from('chat_messages')
        .select('*')
        .or(`from_first_name.ilike.${namePattern},from_username.ilike.${namePattern},and(from_is_bot.eq.true,message_text.ilike.${botPattern})`)
        .order('created_at', { ascending: false })
        .limit(500);

    if (chatError) console.error('[CustomerProfile] Chat fetch error:', chatError);

    const chatMessages = (rawMessages || []).filter(msg => {
        if (!msg.from_is_bot) {
            const firstName = (msg.from_first_name || '').toLowerCase();
            const username = (msg.from_username || '').toLowerCase();
            const lowerSearch = searchName.toLowerCase();

            if (searchName.length <= 2) {
                return firstName === lowerSearch || username === lowerSearch;
            }
            return firstName.includes(lowerSearch) || username.includes(lowerSearch);
        }

        const text = msg.message_text || '';
        const lowerText = text.toLowerCase();
        const lowerSearch = searchName.toLowerCase();

        // Bot patterns for matching (strict for short names)
        if (searchName.length <= 2) {
            // Pattern 1: Starts with "Q CF" or "Q CF" is in the message
            if (new RegExp(`^${lowerSearch}\\s+cf\\b`, 'i').test(text) ||
                new RegExp(`\\n${lowerSearch}\\s+cf\\b`, 'i').test(text)) return true;

            // Pattern 2: "• Client: Q"
            if (text.includes(`• Client: ${searchName}`) || lowerText.includes(`client: ${lowerSearch}`)) return true;

            // Pattern 3: Explicit mentions of the name with CF but potentially not at start
            if (text.includes(`${searchName} CF`)) return true;

            return false;
        }

        // For longer names, more relaxed includes but still check context
        if (lowerText.includes(lowerSearch)) {
            // If it's a quote or confirmation, check if this name is the Client
            if (text.includes('Rate Offer') || text.includes('CF')) {
                const clientMatch = text.match(/Client:\s*([^•\n\r]+)/i);
                if (clientMatch) {
                    const clientName = clientMatch[1].trim().toLowerCase();
                    return clientName === lowerSearch || clientName.includes(lowerSearch);
                }
            }
            return true;
        }

        return false;
    });

    // Fix timezone for customer messages (subtract 7 hours to compensate for double offset)
    const timezoneOffsetMs = 7 * 60 * 60 * 1000;
    const formattedChatMessages = (chatMessages || []).map(msg => ({
        ...msg,
        created_at: new Date(new Date(msg.created_at).getTime() - timezoneOffsetMs).toISOString()
    }));

    console.log(`[CustomerProfile] Found chat messages: ${formattedChatMessages.length} (corrected for timezone)`);

    // Also fetch ALL recent chat messages for pattern analysis (not just customer-specific)
    const { data: allRecentMessagesRaw } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

    const allRecentMessages = (allRecentMessagesRaw || []).map(msg => ({
        ...msg,
        created_at: new Date(new Date(msg.created_at).getTime() - timezoneOffsetMs).toISOString()
    }));

    // Analyze messages for quote/confirmation patterns
    let quoteMetrics;
    if (allRecentMessages && allRecentMessages.length > 0) {
        const analysis = analyzeMessages(allRecentMessages);
        // Use transactions for reconciliation to fix type/time discrepancies
        quoteMetrics = calculateCustomerMetrics(customerName, analysis, transactions);
        console.log(`[CustomerProfile] Quote metrics for ${customerName}:`, {
            quotes: quoteMetrics.quoteCount,
            confirmations: quoteMetrics.confirmationCount,
            ratio: quoteMetrics.quoteToConfirmRatio
        });
    }

    // Get existing analytics (may not exist if table not created yet)
    let analytics: CustomerAnalytics | undefined = undefined;
    try {
        const { data, error } = await supabase
            .from('customer_analytics')
            .select('*')
            .eq('customer_name', customerName)
            .single();

        if (!error && data) {
            analytics = data as CustomerAnalytics;
        }
    } catch (e) {
        // Table may not exist yet - ignore error
        console.warn('[CustomerProfile] Analytics table not available:', e);
    }

    // Return profile even if transactions is empty (for new customers or display issues)
    return {
        name: customerName,
        displayName: analytics?.display_name || customerName,
        transactions: transactions.sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        ),
        chatMessages: formattedChatMessages || [],
        analytics: analytics as CustomerAnalytics | undefined,
        quoteMetrics
    };
}

/**
 * Fetch transactions from oplog_sessions table
 */
async function fetchOplogTransactions(customerName: string): Promise<OtcTransactionSummary[]> {
    const { data: sessions, error } = await supabase
        .from('oplog_sessions')
        .select(`
            id,
            otc_transactions,
            start_time,
            end_time,
            day:oplog_days!inner(log_date)
        `)
        .not('otc_transactions', 'is', null);

    if (error) {
        console.error('Error fetching sessions:', error);
        return [];
    }

    const transactions: OtcTransactionSummary[] = [];
    const searchName = customerName.trim().toLowerCase();

    sessions?.forEach(session => {
        const txns = session.otc_transactions as any[] || [];
        const date = (session.day as any)?.log_date;

        txns.forEach((tx, idx) => {
            const txCustomerName = tx.customerName?.trim();
            const txCustomerNameLower = txCustomerName?.toLowerCase();

            // Match exact or contains
            if (txCustomerNameLower === searchName ||
                txCustomerNameLower?.includes(searchName) ||
                (txCustomerNameLower && searchName.includes(txCustomerNameLower))) {
                transactions.push({
                    id: tx.id || `oplog-${session.id}-${idx}`,
                    date: date,
                    action: tx.action,
                    amount: tx.amount || 0,
                    currency: tx.currency || 'USDT',
                    rate: tx.rate || 0,
                    session_id: session.id
                });
            }
        });
    });

    console.log('[CustomerProfile] Oplog transactions:', transactions.length);
    return transactions;
}

/**
 * Fetch transactions from Customer API
 */
async function fetchCustomerApiTransactions(customerName: string): Promise<OtcTransactionSummary[]> {
    try {
        const url = `/api/customers/transactions?customerName=${encodeURIComponent(customerName)}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.warn('[CustomerProfile] Customer API not available:', response.status);
            return [];
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            console.warn('[CustomerProfile] Customer API returned non-array:', typeof data);
            return [];
        }

        return data.map((tx: any, idx: number) => ({
            id: tx.txn_id || `api-${idx}`,
            date: tx.transaction_date || tx.date,
            action: (tx.action?.toUpperCase() === 'BUY' ? 'BUY' : 'SELL') as 'BUY' | 'SELL',
            amount: typeof tx.amount === 'string' ? parseFloat(tx.amount) : (tx.amount || 0),
            currency: tx.currency_code || tx.currency || 'USDT',
            rate: typeof tx.price === 'string' ? parseFloat(tx.price) : (tx.price || tx.rate || 0),
            session_id: 'customer-api'
        }));
    } catch (error) {
        console.warn('[CustomerProfile] Customer API fetch failed:', error);
        return [];
    }
}



/**
 * Calculate distribution of behaviors based on merged customer list
 */
export async function getBehaviorStats(customers?: CustomerListItem[]): Promise<BehaviorStats> {
    const list = customers || await getAllCustomers();

    const stats: BehaviorStats = {
        hot_lead: 0,
        negotiator: 0,
        window_shopper: 0,
        ghost: 0,
        vip_repeat: 0,
        new_prospect: 0,
        total: list.length
    };

    list.forEach(c => {
        const type = c.behaviorType;
        if (type in stats) {
            stats[type]++;
        }
    });

    return stats;
}

/**
 * Get customers needing followup
 */
export async function getFollowupAlerts(): Promise<CustomerListItem[]> {
    const { data, error } = await supabase
        .from('customer_analytics')
        .select('*')
        .eq('needs_followup', true)
        .order('followup_priority', { ascending: false })
        .order('last_contact', { ascending: true });

    if (error) {
        throw error;
    }

    return data?.map(a => ({
        name: a.customer_name,
        displayName: a.display_name || a.customer_name,
        behaviorType: a.behavior_type as BehaviorType,
        engagementScore: a.engagement_score,
        totalVolume: a.total_volume,
        transactionCount: a.total_transactions,
        lastContact: a.last_contact,
        needsFollowup: true,
        followupPriority: a.followup_priority as FollowupPriority
    })) || [];
}

/**
 * Save customer analytics
 */
export async function saveCustomerAnalytics(
    analytics: Partial<CustomerAnalytics>
): Promise<CustomerAnalytics> {
    const { data, error } = await supabase
        .from('customer_analytics')
        .upsert({
            customer_name: analytics.customer_name,
            display_name: analytics.display_name,
            behavior_type: analytics.behavior_type,
            engagement_score: analytics.engagement_score,
            total_transactions: analytics.total_transactions,
            total_volume: analytics.total_volume,
            avg_transaction_size: analytics.avg_transaction_size,
            last_transaction_date: analytics.last_transaction_date,
            total_messages: analytics.total_messages,
            first_contact: analytics.first_contact,
            last_contact: analytics.last_contact,
            avg_response_time_minutes: analytics.avg_response_time_minutes,
            sentiment: analytics.sentiment,
            ai_summary: analytics.ai_summary,
            recommendations: analytics.recommendations,
            risk_flags: analytics.risk_flags,
            key_topics: analytics.key_topics,
            needs_followup: analytics.needs_followup,
            followup_reason: analytics.followup_reason,
            followup_priority: analytics.followup_priority,
            provider: analytics.provider,
            model: analytics.model,
            analyzed_at: new Date().toISOString()
        }, {
            onConflict: 'customer_name'
        })
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to save analytics: ${error.message}`);
    }

    return data as CustomerAnalytics;
}

/**
 * Mark followup as done
 */
export async function markFollowupDone(customerName: string): Promise<void> {
    const { error } = await supabase
        .from('customer_analytics')
        .update({
            needs_followup: false,
            last_followup_at: new Date().toISOString()
        })
        .eq('customer_name', customerName);

    if (error) {
        throw error;
    }
}

/**
 * Get analytics summary for dashboard
 */
export async function getAnalyticsSummary(): Promise<{
    totalCustomers: number;
    activeCustomers: number;
    totalVolume: number;
    avgEngagement: number;
    needsFollowup: number;
    behaviorStats: BehaviorStats;
}> {
    // Get local analytics data
    const { data: analyticsData, error } = await supabase
        .from('customer_analytics')
        .select('*');

    if (error) {
        console.error('Error fetching analytics summary:', error);
    }

    // Get the full merged list to get the real total count
    const allCustomers = await getAllCustomers();
    // Calculate stats directly from the full list for consistency
    const stats = await getBehaviorStats(allCustomers);

    const activeCustomers = allCustomers.filter(c => {
        if (!c.lastContact) return false;
        const daysSinceContact = (Date.now() - new Date(c.lastContact).getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceContact <= 30;
    }).length;

    const totalVolume = allCustomers.reduce((sum, c) => sum + (c.totalVolume || 0), 0);
    const avgEngagement = allCustomers.length
        ? allCustomers.reduce((sum, c) => sum + (c.engagementScore || 0), 0) / allCustomers.length
        : 0;
    const needsFollowup = allCustomers.filter(c => c.needsFollowup).length;

    return {
        totalCustomers: allCustomers.length,
        activeCustomers,
        totalVolume,
        avgEngagement,
        needsFollowup,
        behaviorStats: stats
    };
}
