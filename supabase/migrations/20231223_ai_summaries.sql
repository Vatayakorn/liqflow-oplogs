-- Migration: Create AI Summary Table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS session_ai_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES oplog_sessions(id) ON DELETE CASCADE,
    summary_text TEXT NOT NULL,
    insights JSONB DEFAULT '{}',
    provider TEXT NOT NULL CHECK (provider IN ('openai', 'gemini')),
    model TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint to ensure one summary per session
    CONSTRAINT unique_session_summary UNIQUE (session_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_session_ai_summaries_session_id 
ON session_ai_summaries(session_id);

-- Enable RLS
ALTER TABLE session_ai_summaries ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (adjust as needed)
CREATE POLICY "Allow all for authenticated users" ON session_ai_summaries
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Grant access
GRANT ALL ON session_ai_summaries TO authenticated;
GRANT ALL ON session_ai_summaries TO anon;

-- =============================================
-- Daily AI Summaries Table
-- =============================================

CREATE TABLE IF NOT EXISTS day_ai_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_date DATE NOT NULL UNIQUE,
    total_volume NUMERIC DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    buy_volume NUMERIC DEFAULT 0,
    sell_volume NUMERIC DEFAULT 0,
    shift_stats JSONB DEFAULT '{}',
    summary_text TEXT NOT NULL,
    insights JSONB DEFAULT '{}',
    provider TEXT NOT NULL CHECK (provider IN ('openai', 'gemini')),
    model TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_day_ai_summaries_log_date 
ON day_ai_summaries(log_date);

-- Enable RLS
ALTER TABLE day_ai_summaries ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users
CREATE POLICY "Allow all for authenticated users" ON day_ai_summaries
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Grant access
GRANT ALL ON day_ai_summaries TO authenticated;
GRANT ALL ON day_ai_summaries TO anon;
