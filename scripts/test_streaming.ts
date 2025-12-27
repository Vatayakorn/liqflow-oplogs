import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function streamMarketData(
    source: string,
    startTime: string,
    endTime: string,
    onChunk: (data: any[]) => void
) {
    let lastTime = startTime;
    let totalFetched = 0;
    const pageSize = 1000;
    const safetyLimit = 500000;

    console.log(`[Test] Streaming ${source} from ${startTime} to ${endTime}`);

    while (totalFetched < safetyLimit) {
        const { data, error } = await supabase
            .from('market_data')
            .select('created_at, price')
            .eq('source', source)
            .gte('created_at', lastTime)
            .lte('created_at', endTime)
            .order('created_at', { ascending: true })
            .limit(pageSize);

        if (error) {
            console.error('Error:', error);
            break;
        }

        if (!data || data.length === 0) break;

        onChunk(data);
        totalFetched += data.length;

        const lastRecord = data[data.length - 1];
        const nextTime = new Date(new Date(lastRecord.created_at).getTime() + 1).toISOString();

        if (nextTime === lastTime) break;
        lastTime = nextTime;

        if (data.length < pageSize) break;
    }

    console.log(`[Test] Total fetched: ${totalFetched}`);
    return totalFetched;
}

async function run() {
    // 3 days should be enough to cross 50k for some sources if dense
    // Or 1 week to be sure.
    const hours = 168;
    const endTime = new Date().toISOString();
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    // Use a high frequency source
    await streamMarketData('bitkub', startTime, endTime, (chunk) => {
        // no-op, just counting
    });
}

run();
