/**
 * Customer API Service
 * ดึงข้อมูลลูกค้าและ transactions จาก LiqFlow Customer API
 */

import type { OtcTransactionSummary } from './customerAnalytics';

// Types matching the Customer API response
export interface CustomerTransactionResponse {
    txn_id: string;
    customer_name: string;
    action: string;
    amount: number | string;
    currency_code: string;
    price: number | string;
    total: number | string;
    status: string;
    transaction_date: string;
    created_by: string;
}

export interface CustomerResponse {
    customer_name: string;
    total_transactions: number;
    total_volume: number;
    transactions: CustomerTransactionResponse[];
}

/**
 * Fetch customer transactions from the Customer API
 * Uses the same proxy pattern as OTC API
 */
export async function fetchCustomerTransactions(
    customerName: string,
    dateFrom?: string,
    dateTo?: string
): Promise<OtcTransactionSummary[]> {
    try {
        let url = `/api/customers/transactions?customerName=${encodeURIComponent(customerName)}`;
        if (dateFrom) url += `&dateFrom=${dateFrom}`;
        if (dateTo) url += `&dateTo=${dateTo}`;

        console.log('[Customer API] Fetching:', url);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        console.log('[Customer API] Response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[Customer API] Error:', errorData);
            // Return empty array instead of throwing - API might not be configured
            return [];
        }

        const data: CustomerTransactionResponse[] = await response.json();

        // Map to OtcTransactionSummary format
        return data.map((tx, idx) => ({
            id: tx.txn_id || `api-${idx}-${Date.now()}`,
            customerName: tx.customer_name,
            date: tx.transaction_date,
            action: tx.action.toUpperCase() === 'BUY' ? 'BUY' as const : 'SELL' as const,
            amount: typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount,
            currency: tx.currency_code || 'USDT',
            rate: typeof tx.price === 'string' ? parseFloat(tx.price) : tx.price,
            session_id: 'external-api'
        }));
    } catch (error) {
        console.error('[Customer API] Failed:', error);
        return []; // Return empty instead of throwing
    }
}

/**
 * Fetch all customers list from Customer API
 */
export async function fetchAllCustomersFromAPI(): Promise<{
    name: string;
    totalTransactions: number;
    totalVolume: number;
}[]> {
    try {
        const response = await fetch('/api/customers/list', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            console.warn('[Customer API] List fetch failed:', response.status);
            return [];
        }

        return await response.json();
    } catch (error) {
        console.error('[Customer API] List fetch error:', error);
        return [];
    }
}
