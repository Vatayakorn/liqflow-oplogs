/**
 * Operation Log API Helper Functions
 * CRUD operations for days, sessions, and images
 */

import { supabase, STORAGE_BUCKET } from '$lib/supabaseClient';

// ============================================
// Types
// ============================================

export interface OplogDay {
    id: string;
    log_date: string;
    created_at: string;
}

export interface OplogSession {
    id: string;
    day_id: string;
    shift: 'A' | 'B' | 'C';
    preset_key: string | null;
    start_time: string;
    end_time: string | null;
    broker: string;
    trader: string;
    head: string;
    market_mode: string | null;
    inventory_status: string | null;
    risk_flag: string | null;
    execution_issue: string | null;
    pnl_snapshot: number | null;
    action_taken: string | null;
    note: string;
    created_at: string;
    images?: OplogSessionImage[];
}

export interface OplogSessionImage {
    id: string;
    session_id: string;
    storage_path: string;
    public_url: string;
    created_at: string;
}

export interface CreateSessionPayload {
    log_date: string;
    shift: 'A' | 'B' | 'C';
    preset_key?: string;
    start_time: string;
    end_time?: string;
    broker: string;
    trader: string;
    head: string;
    market_mode?: string;
    inventory_status?: string;
    risk_flag?: string;
    execution_issue?: string;
    pnl_snapshot?: number;
    action_taken?: string;
    note: string;
}

// ============================================
// Day Operations
// ============================================

/**
 * Get or create a day record for the given date
 * @param log_date - Date string in YYYY-MM-DD format
 * @returns The day record
 */
export async function getOrCreateDay(log_date: string): Promise<OplogDay> {
    // First try to find existing day
    const { data: existingDay, error: findError } = await supabase
        .from('oplog_days')
        .select('*')
        .eq('log_date', log_date)
        .single();

    if (existingDay && !findError) {
        return existingDay;
    }

    // Create new day if not found
    const { data: newDay, error: createError } = await supabase
        .from('oplog_days')
        .insert({ log_date })
        .select()
        .single();

    if (createError) {
        throw new Error(`Failed to create day: ${createError.message}`);
    }

    return newDay;
}

/**
 * List all days with session counts
 * @returns Array of days with session counts
 */
export async function listDays(): Promise<(OplogDay & { session_count: number })[]> {
    const { data, error } = await supabase
        .from('oplog_days')
        .select(`
      *,
      oplog_sessions(count)
    `)
        .order('log_date', { ascending: false });

    if (error) {
        throw new Error(`Failed to list days: ${error.message}`);
    }

    return data.map((day) => ({
        ...day,
        session_count: day.oplog_sessions?.[0]?.count || 0
    }));
}

// ============================================
// Session Operations
// ============================================

/**
 * List sessions for a specific date, including images
 * Sessions are grouped by shift and ordered by start_time
 * @param log_date - Date string in YYYY-MM-DD format
 * @returns Array of sessions with images
 */
export async function listSessionsByDate(log_date: string): Promise<OplogSession[]> {
    // First get the day
    const { data: day, error: dayError } = await supabase
        .from('oplog_days')
        .select('id')
        .eq('log_date', log_date)
        .single();

    if (dayError || !day) {
        return []; // No sessions for this date
    }

    // Get sessions with images
    const { data: sessions, error: sessionsError } = await supabase
        .from('oplog_sessions')
        .select(`
      *,
      images:oplog_session_images(*)
    `)
        .eq('day_id', day.id)
        .order('shift', { ascending: true })
        .order('start_time', { ascending: true });

    if (sessionsError) {
        throw new Error(`Failed to list sessions: ${sessionsError.message}`);
    }

    return sessions || [];
}

/**
 * Create a new session
 * @param payload - Session data including log_date
 * @returns The created session
 */
export async function createSession(payload: CreateSessionPayload): Promise<OplogSession> {
    const { log_date, ...sessionData } = payload;

    // Get or create the day first
    const day = await getOrCreateDay(log_date);

    // Create the session
    const { data: session, error } = await supabase
        .from('oplog_sessions')
        .insert({
            day_id: day.id,
            ...sessionData
        })
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to create session: ${error.message}`);
    }

    return session;
}

/**
 * Get a single session by ID with images
 * @param session_id - Session UUID
 * @returns Session with images or null
 */
export async function getSession(session_id: string): Promise<OplogSession | null> {
    const { data, error } = await supabase
        .from('oplog_sessions')
        .select(`
      *,
      images:oplog_session_images(*)
    `)
        .eq('id', session_id)
        .single();

    if (error) {
        return null;
    }

    return data;
}

/**
 * Delete a session and its images
 * @param session_id - Session UUID
 */
export async function deleteSession(session_id: string): Promise<void> {
    // First get the session to find associated images
    const { data: session } = await supabase
        .from('oplog_sessions')
        .select('*, images:oplog_session_images(*)')
        .eq('id', session_id)
        .single();

    if (session?.images) {
        // Delete images from storage
        const paths = session.images.map((img: OplogSessionImage) => img.storage_path);
        if (paths.length > 0) {
            await supabase.storage.from(STORAGE_BUCKET).remove(paths);
        }
    }

    // Delete session (images will cascade)
    const { error } = await supabase
        .from('oplog_sessions')
        .delete()
        .eq('id', session_id);

    if (error) {
        throw new Error(`Failed to delete session: ${error.message}`);
    }
}

// ============================================
// Image Operations
// ============================================

/**
 * Upload images for a session
 * @param log_date - Date string for path organization
 * @param shift - Shift letter (A/B/C)
 * @param session_id - Session UUID
 * @param files - Array of File objects to upload
 * @returns Array of created image records
 */
export async function uploadImages(
    log_date: string,
    shift: string,
    session_id: string,
    files: File[]
): Promise<OplogSessionImage[]> {
    const uploadedImages: OplogSessionImage[] = [];

    for (const file of files) {
        // Generate unique filename
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const path = `${log_date}/${shift}/${session_id}/${timestamp}_${safeName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(path, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            console.error(`Failed to upload ${file.name}:`, uploadError);
            continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(path);

        // Insert image record
        const { data: imageRecord, error: insertError } = await supabase
            .from('oplog_session_images')
            .insert({
                session_id,
                storage_path: path,
                public_url: urlData.publicUrl
            })
            .select()
            .single();

        if (insertError) {
            console.error(`Failed to insert image record:`, insertError);
            continue;
        }

        uploadedImages.push(imageRecord);
    }

    return uploadedImages;
}

/**
 * Delete a single image
 * @param image_id - Image UUID
 */
export async function deleteImage(image_id: string): Promise<void> {
    // Get the image to find storage path
    const { data: image } = await supabase
        .from('oplog_session_images')
        .select('storage_path')
        .eq('id', image_id)
        .single();

    if (image) {
        // Delete from storage
        await supabase.storage.from(STORAGE_BUCKET).remove([image.storage_path]);
    }

    // Delete record
    const { error } = await supabase
        .from('oplog_session_images')
        .delete()
        .eq('id', image_id);

    if (error) {
        throw new Error(`Failed to delete image: ${error.message}`);
    }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Group sessions by shift
 * @param sessions - Array of sessions
 * @returns Object with sessions grouped by shift
 */
export function groupSessionsByShift(sessions: OplogSession[]): Record<string, OplogSession[]> {
    return sessions.reduce((acc, session) => {
        const shift = session.shift;
        if (!acc[shift]) {
            acc[shift] = [];
        }
        acc[shift].push(session);
        return acc;
    }, {} as Record<string, OplogSession[]>);
}
