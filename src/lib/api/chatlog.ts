/**
 * Chat Log API
 * Fetches chat messages from Supabase for a given time range
 */

import { supabase } from '$lib/supabaseClient';

// ============================================
// Types
// ============================================

export interface ChatMessage {
    id: number;
    from_username: string | null;
    from_first_name: string | null;
    from_is_bot: boolean;
    message_text: string | null;
    content_type: string | null;
    direction: string; // 'in' or 'out'
    created_at: string;
    chat_title: string | null;
}

// ============================================
// API Functions
// ============================================

/**
 * Get chat messages for a specific datetime range
 * @param startDatetime - Start of the time range (ISO string or Date)
 * @param endDatetime - End of the time range (ISO string or Date)
 * @returns Array of chat messages ordered by created_at ASC
 */
export async function getChatMessagesForTimeRange(
    startDatetime: Date | string,
    endDatetime: Date | string
): Promise<ChatMessage[]> {
    const startStr = typeof startDatetime === 'string' ? startDatetime : startDatetime.toISOString();
    const endStr = typeof endDatetime === 'string' ? endDatetime : endDatetime.toISOString();

    const { data, error } = await supabase
        .from('chat_messages')
        .select(`
            id,
            from_username,
            from_first_name,
            from_is_bot,
            message_text,
            content_type,
            direction,
            created_at,
            chat_title
        `)
        .gte('created_at', startStr)
        .lte('created_at', endStr)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching chat messages:', error);
        throw error;
    }

    return data || [];
}
