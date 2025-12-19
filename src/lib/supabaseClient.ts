import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { browser } from '$app/environment';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

/**
 * Supabase Client
 * Uses public environment variables for client-side access
 */

let supabaseInstance: SupabaseClient | null = null;



function getSupabaseClient(): SupabaseClient {
    if (supabaseInstance) return supabaseInstance;

    // Get environment variables
    const supabaseUrl = PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your-project')) {
        console.warn('⚠️ Supabase credentials not configured. Please set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY in your .env file.');
        // Return a dummy client that will fail gracefully
        // This allows the UI to render without crashing
        supabaseInstance = createClient(
            'https://placeholder.supabase.co',
            'placeholder-key'
        );
        return supabaseInstance;
    }

    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    return supabaseInstance;
}

// Export a getter function and a lazy-loaded client
export const getSupabase = getSupabaseClient;

// For backwards compatibility, export supabase directly
// Will be initialized when first accessed in browser
export const supabase = browser
    ? getSupabaseClient()
    : createClient('https://placeholder.supabase.co', 'placeholder-key');

/**
 * Check if Supabase is properly configured
 */
export function isSupabaseConfigured(): boolean {
    const url = PUBLIC_SUPABASE_URL || '';
    const key = PUBLIC_SUPABASE_ANON_KEY || '';
    return !!(url && key && !url.includes('your-project') && !url.includes('placeholder'));
}

/**
 * Storage bucket name for images
 */
export const STORAGE_BUCKET = 'oplog-images';
