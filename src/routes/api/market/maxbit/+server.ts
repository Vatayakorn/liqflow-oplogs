import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
    const symbol = url.searchParams.get('symbol') || 'usdt';

    try {
        const response = await fetch('https://maxbitapi-prd.unit.co.th/api/otc', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'secret-api': 'MAXBITOTC',
                'secret-key': '2e104ac5-2cea-41b9-bb02-15ff1580917b',
            },
            body: JSON.stringify({
                groupid: 'C38a571cc9b25c98313b2b4e9de20854f',
                symbol,
            }),
        });

        const data = await response.json();

        if (data.responseCode !== '000') {
            return json({ error: data.responseMessage || 'MaxBit API Error' }, { status: 400 });
        }

        return json(data);
    } catch (error) {
        console.error('[MaxBit Proxy Error]:', error);
        return json({ error: 'Failed to fetch MaxBit price' }, { status: 500 });
    }
};
