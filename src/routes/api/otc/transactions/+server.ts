import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import crypto from 'crypto';
import { env } from '$env/dynamic/private';

const LF_API_BASE_URL = env.LF_API_BASE_URL || '';
const LF_API_SECRET_KEY = env.LF_AUTH_SECRET || env.LF_API_SECRET_KEY || '';

/**
 * GET /api/otc/transactions
 * Fetches OTC transactions for a given date with server-side HMAC authentication
 */
export const GET: RequestHandler = async ({ url }) => {
    if (!LF_API_BASE_URL || !LF_API_SECRET_KEY) {
        console.error('[OTC API Proxy] LF_API_BASE_URL or Secret Key not configured');
        return json({ error: 'API not configured' }, { status: 500 });
    }

    const date = url.searchParams.get('date') || getTodayDate();
    const limit = url.searchParams.get('limit') || '100';
    const offset = url.searchParams.get('offset') || '0';

    try {
        // Use current timestamp in seconds (common in Python backends)
        const timestamp = Math.floor(Date.now() / 1000).toString();

        // As per provided logic: computed_signature = hmac.new(secret.encode(), timestamp.encode(), hashlib.sha256).hexdigest()
        const signature = crypto.createHmac('sha256', LF_API_SECRET_KEY)
            .update(timestamp)
            .digest('hex');

        // Remove trailing slash from base URL if it exists
        const cleanBaseUrl = LF_API_BASE_URL.replace(/\/$/, '');
        // The openapi.json reveals the correct path is /transactions/by-date without /api/v1 prefix
        const apiUrl = `${cleanBaseUrl}/transactions/by-date?date=${date}&limit=${limit}&offset=${offset}`;

        console.log('[OTC API Proxy] Signature Message (Timestamp):', timestamp);
        console.log('[OTC API Proxy] Fetching:', apiUrl);

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-timestamp': timestamp,
                'x-lf-auth': signature,
            },
        });

        console.log('[OTC API Proxy] Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[OTC API Proxy] Error:', response.status, errorText);

            return json({
                error: `API error: ${response.status}`,
                details: errorText
            }, { status: response.status });
        }

        const data = await response.json();
        return json(data);
    } catch (error) {
        console.error('[OTC API Proxy] Failed:', error);
        return json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }
};

function getTodayDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
