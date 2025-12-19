import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
    try {
        const response = await fetch('https://www.google.com/finance/quote/USD-THB?hl=en', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const html = await response.text();

        // Google Finance uses the class "fxKbKc" for the primary exchange rate on the page
        const priceRegex = /class="[^"]*fxKbKc[^"]*"[^>]*>([0-9,.]+)</;
        const match = html.match(priceRegex);

        if (!match || !match[1]) {
            console.error('[FX Proxy] Failed to parse. HTML Snippet:', html.substring(0, 1000));
            return json({ error: 'Failed to parse Google Finance' }, { status: 500 });
        }

        const rate = parseFloat(match[1].replace(/,/g, ''));

        return json({
            rate,
            source: 'Google Finance',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[FX Proxy Error]:', error);
        return json({ error: 'Failed to fetch FX rate' }, { status: 500 });
    }
};
