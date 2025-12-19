/**
 * OTC Transaction API Service
 * Fetches OTC transactions via server-side proxy
 */

import type { OtcTransaction, OtcAction } from '$lib/config/tradingConfig';

// Types matching the API response
interface ApiOTCTransaction {
    txn_id: string;
    amount: string | number;
    price: string | number;
    total: string | number;
    txn_type: string;
    commission_rate: string | number | null;
    total_commission: string | number | null;
    mod_number: number;
    customer_name: string;
    currency_code: string;
    created_by: string;
    status: string;
    transaction_date: string;
    action: string;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Map API action to OtcAction type
 */
function mapAction(action: string): OtcAction {
    const upperAction = action.toUpperCase();
    if (upperAction === 'BUY') return 'BUY';
    if (upperAction === 'SELL') return 'SELL';
    return 'BUY'; // Default to BUY
}

/**
 * Map API transaction to local OtcTransaction format
 */
function mapApiTransaction(apiTx: ApiOTCTransaction): OtcTransaction {
    return {
        id: apiTx.txn_id,
        source: 'BTZ', // Default source since API doesn't provide this
        customerName: apiTx.customer_name,
        action: mapAction(apiTx.action),
        amount: typeof apiTx.amount === 'string' ? parseFloat(apiTx.amount) : apiTx.amount,
        currency: (apiTx.currency_code as 'USDT' | 'USDC' | 'THB') || 'USDT',
        rate: typeof apiTx.price === 'string' ? parseFloat(apiTx.price) : apiTx.price,
        timestamp: apiTx.transaction_date,
        status: apiTx.status,
        total: typeof apiTx.total === 'string' ? parseFloat(apiTx.total) : apiTx.total,
        txnType: apiTx.txn_type,
    };
}

/**
 * Fetch OTC transactions from midnight today until now
 * Uses server-side proxy for authentication
 */
export async function fetchTodayOtcTransactions(): Promise<OtcTransaction[]> {
    try {
        const today = getTodayDate();
        const url = `/api/otc/transactions?date=${today}&limit=100&offset=0`;

        console.log('[OTC API] Fetching via proxy:', url);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        console.log('[OTC API] Response status:', response.status, response.statusText);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `API error: ${response.status} ${response.statusText}`);
        }

        const data: ApiOTCTransaction[] = await response.json();

        // Map API transactions to local format
        const transactions = data.map(mapApiTransaction);

        // Sort by timestamp descending (latest first)
        transactions.sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return timeB - timeA;
        });

        console.log(`[OTC API] Fetched ${transactions.length} transactions for today`);
        return transactions;
    } catch (error) {
        console.error('[OTC API] Failed to fetch transactions:', error);
        throw error; // Re-throw so caller can handle
    }
}

/**
 * Check if OTC API is configured (always true now since server handles it)
 */
export function isOtcApiConfigured(): boolean {
    return true;
}

