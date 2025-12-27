// Database check script for market_data table
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
    process.env.PUBLIC_SUPABASE_URL,
    process.env.PUBLIC_SUPABASE_ANON_KEY
);

async function checkDatabase() {
    console.log('\n=== Market Data Coverage Check ===\n');

    // Get total count
    const { count: totalCount } = await supabase
        .from('market_data')
        .select('*', { count: 'exact', head: true });

    console.log(`Total records in market_data: ${totalCount?.toLocaleString()}`);

    // Get date range
    const { data: oldest } = await supabase
        .from('market_data')
        .select('created_at')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

    const { data: newest } = await supabase
        .from('market_data')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    console.log(`\nDate Range:`);
    console.log(`  Oldest: ${oldest?.created_at}`);
    console.log(`  Newest: ${newest?.created_at}`);

    // Get counts by source
    console.log('\nRecords by Source:');
    const sources = ['bitkub', 'binance_th', 'maxbit', 'fx', 'zcom', 'xspring', 'bitazza'];

    for (const source of sources) {
        const { count } = await supabase
            .from('market_data')
            .select('*', { count: 'exact', head: true })
            .eq('source', source);
        console.log(`  ${source}: ${count?.toLocaleString() || 0}`);
    }

    // Get data coverage by day (last 7 days)
    console.log('\nRecords by Date (last 7 days):');
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dayStart = new Date(date.setHours(0, 0, 0, 0)).toISOString();
        const dayEnd = new Date(date.setHours(23, 59, 59, 999)).toISOString();

        const { count } = await supabase
            .from('market_data')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', dayStart)
            .lte('created_at', dayEnd);

        const dateStr = new Date(dayStart).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: '2-digit' });
        console.log(`  ${dateStr}: ${count?.toLocaleString() || 0} records`);
    }

    console.log('\n=================================\n');
}

checkDatabase().catch(console.error);
