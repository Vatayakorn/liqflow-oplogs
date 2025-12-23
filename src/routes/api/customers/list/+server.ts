import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

/**
 * GET /api/customers/list
 * Fetches the full list of customers from the Customer API
 */
export const GET: RequestHandler = async () => {
    const CUSTOMER_API_URL = env.CUSTOMER_API_URL || 'https://lf-api.wg-kube.com/v1/customers';
    const CUSTOMER_API_KEY = env.CUSTOMER_API_KEY || 'zy8rzcj1po9wc1y4t0nrogqs7hz';

    try {
        console.log('[Customer API Proxy] Fetching customer list from:', CUSTOMER_API_URL);

        const response = await fetch(CUSTOMER_API_URL, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': CUSTOMER_API_KEY
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Customer API Proxy] Error:', response.status, errorText);
            return json({ error: `API error: ${response.status}` }, { status: response.status });
        }

        const data = await response.json();

        // Map to expected format if needed, but for now just pass through
        // Expected format: { name: string, created_at: string }[]
        // Frontend expects: { name: string, totalTransactions: number, totalVolume: number }[]

        const formattedData = Array.isArray(data) ? data.map((c: any) => ({
            name: c.name,
            totalTransactions: 0, // Will be aggregated in the frontend/logic
            totalVolume: 0,
            created_at: c.created_at
        })) : [];

        return json(formattedData);
    } catch (error) {
        console.error('[Customer API Proxy] Failed:', error);
        return json({ error: 'Failed to fetch customer list' }, { status: 500 });
    }
};
