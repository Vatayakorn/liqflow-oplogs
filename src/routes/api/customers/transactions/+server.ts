import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import crypto from 'crypto';
import { env } from '$env/dynamic/private';

// Use the same API as OTC transactions
const LF_API_BASE_URL = env.LF_API_BASE_URL || '';
const LF_API_SECRET_KEY = env.LF_AUTH_SECRET || env.LF_API_SECRET_KEY || '';

/**
 * GET /api/customers/transactions
 * Fetches customer transactions from the LF API
 * Uses the same HMAC authentication as /api/otc/transactions
 */
export const GET: RequestHandler = async ({ url }) => {
    if (!LF_API_BASE_URL || !LF_API_SECRET_KEY) {
        console.error('[Customer API Proxy] LF_API_BASE_URL or Secret Key not configured');
        return json({ error: 'API not configured' }, { status: 500 });
    }

    const customerName = url.searchParams.get('customerName');
    const dateFrom = url.searchParams.get('dateFrom');
    const dateTo = url.searchParams.get('dateTo');
    const limit = url.searchParams.get('limit') || '500';

    if (!customerName) {
        return json({ error: 'customerName is required' }, { status: 400 });
    }

    try {
        // Use current timestamp in seconds (same as OTC API)
        const timestamp = Math.floor(Date.now() / 1000).toString();

        // HMAC signature (same as OTC API)
        const signature = crypto.createHmac('sha256', LF_API_SECRET_KEY)
            .update(timestamp)
            .digest('hex');

        // Build API URL - query by customer name
        const cleanBaseUrl = LF_API_BASE_URL.replace(/\/$/, '');

        // Build query params
        const params = new URLSearchParams();
        params.set('customer_name', customerName);
        params.set('limit', limit);
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);

        // Use /transactions/by-customer endpoint if available, otherwise filter from by-date
        const apiUrl = `${cleanBaseUrl}/transactions/by-customer?${params.toString()}`;

        console.log('[Customer API Proxy] Fetching:', apiUrl);

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-timestamp': timestamp,
                'x-lf-auth': signature,
            },
        });

        console.log('[Customer API Proxy] Response status:', response.status);

        // If by-customer endpoint doesn't exist, try fetching daily transactions in parallel and filtering
        if (response.status === 404) {
            console.log('[Customer API Proxy] by-customer endpoint returned 404, falling back to parallel daily fetch');
            return await fetchAndFilterByCustomerParallel(cleanBaseUrl, customerName, timestamp, signature, limit, dateFrom, dateTo);
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Customer API Proxy] Error:', response.status, errorText);

            return json({
                error: `API error: ${response.status}`,
                details: errorText
            }, { status: response.status });
        }

        const data = await response.json();
        const items = Array.isArray(data) ? data : [];
        return json(items);
    } catch (error) {
        console.error('[Customer API Proxy] Failed:', error);
        return json({ error: 'Failed to fetch customer transactions' }, { status: 500 });
    }
};

/**
 * Parallel: Fetch recent transactions and filter by customer name
 * Fetches last 90 days in batches of 10
 */
async function fetchAndFilterByCustomerParallel(
    baseUrl: string,
    customerName: string,
    timestamp: string,
    signature: string,
    limit: string,
    dateFrom?: string | null,
    dateTo?: string | null
): Promise<Response> {
    try {
        const batchSize = 10;
        const allTransactions: any[] = [];
        const limitNum = parseInt(limit);

        // Determine date range
        const end = dateTo ? new Date(dateTo) : new Date();
        const start = dateFrom ? new Date(dateFrom) : new Date(end);
        if (!dateFrom) start.setDate(start.getDate() - 90);

        // Calculate days to fetch
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const daysToFetch = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        console.log(`[Customer API Proxy] Parallel fetch for ${customerName} from ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]} (${daysToFetch} days)`);

        for (let i = 0; i < daysToFetch; i += batchSize) {
            const batchPromises = [];
            for (let j = 0; j < batchSize && (i + j) < daysToFetch; j++) {
                const date = new Date(end);
                date.setDate(date.getDate() - (i + j));
                const dateStr = date.toISOString().split('T')[0];

                // Stop if we go before start date
                if (date < start) continue;

                const apiUrl = `${baseUrl}/transactions/by-date?date=${dateStr}&limit=500&offset=0`;
                batchPromises.push(
                    fetch(apiUrl, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-timestamp': timestamp,
                            'x-lf-auth': signature,
                        },
                    }).then(async r => {
                        if (r.ok) {
                            const data = await r.json();
                            return Array.isArray(data) ? data : [];
                        }
                        return [];
                    }).catch(() => [])
                );
            }

            const batchResults = await Promise.all(batchPromises);

            for (const dayTransactions of batchResults) {
                const filtered = dayTransactions.filter((tx: any) =>
                    tx.customer_name?.toLowerCase() === customerName.toLowerCase() ||
                    tx.customer_name?.toLowerCase().includes(customerName.toLowerCase())
                );
                allTransactions.push(...filtered);
            }

            // Optimization: if we already have limit and we're just doing recent days, we could stop
            // but for date range we should fetch it all unless limit is small.
            // For now, let's keep it simple.
        }

        console.log(`[Customer API Proxy] Found ${allTransactions.length} transactions for ${customerName} (90 day window)`);

        // Group and deduplicate if necessary (though by-date should be unique per day)
        // Sort by date descending
        allTransactions.sort((a, b) =>
            new Date(b.transaction_date || b.date).getTime() -
            new Date(a.transaction_date || a.date).getTime()
        );

        return json(allTransactions.slice(0, limitNum));
    } catch (error) {
        console.error('[Customer API Proxy] Parallel filter approach failed:', error);
        return json([], { status: 200 });
    }
}
