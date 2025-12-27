import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkData() {
    const hours = 168;
    const endTime = new Date().toISOString();
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    console.log(`Checking data from ${startTime} to ${endTime}`);

    const sources = ['bitkub', 'binance_th', 'maxbit', 'fx', 'zcom', 'xspring', 'bitazza'];

    for (const source of sources) {
        const { count, error } = await supabase
            .from('market_data')
            .select('*', { count: 'exact', head: true })
            .eq('source', source)
            .gte('created_at', startTime)
            .lte('created_at', endTime);

        if (error) {
            console.error(`Error checking ${source}:`, error);
        } else {
            console.log(`Source ${source}: ${count} records`);
        }

        // Check earliest record in range
        const { data: earliest } = await supabase
            .from('market_data')
            .select('created_at')
            .eq('source', source)
            .gte('created_at', startTime)
            .order('created_at', { ascending: true })
            .limit(1);

        if (earliest && earliest.length > 0) {
            console.log(`  Earliest: ${earliest[0].created_at}`);
        }
    }
}

checkData();
