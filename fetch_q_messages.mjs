import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .or('from_first_name.ilike.%Q%,from_username.ilike.%Q%,message_text.ilike.%Q%')
        .order('created_at', { ascending: false })
        .limit(10);
    
    if (error) {
        console.error(error);
        return;
    }
    
    console.log(JSON.stringify(data, null, 2));
}

run();
