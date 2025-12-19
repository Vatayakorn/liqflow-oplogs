-- ============================================
-- Operation Log Database Schema
-- Supabase / PostgreSQL
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- Table: oplog_days
-- One record per unique log date
-- ============================================
CREATE TABLE IF NOT EXISTS oplog_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_date DATE UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: oplog_sessions
-- Multiple sessions per day, with shift tracking
-- ============================================
CREATE TABLE IF NOT EXISTS oplog_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_id UUID NOT NULL REFERENCES oplog_days(id) ON DELETE CASCADE,
    shift TEXT NOT NULL CHECK (shift IN ('A', 'B', 'C')),
    preset_key TEXT NULL,
    start_time TIME NOT NULL,
    end_time TIME NULL,
    broker TEXT NOT NULL,
    trader TEXT NOT NULL,
    head TEXT NOT NULL,
    market_mode TEXT NULL,
    inventory_status TEXT NULL,
    risk_flag TEXT NULL,
    execution_issue TEXT NULL,
    pnl_snapshot NUMERIC NULL,
    action_taken TEXT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: oplog_session_images
-- Multiple images per session
-- ============================================
CREATE TABLE IF NOT EXISTS oplog_session_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES oplog_sessions(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_oplog_sessions_day_shift_time 
    ON oplog_sessions(day_id, shift, start_time);

CREATE INDEX IF NOT EXISTS idx_oplog_session_images_session 
    ON oplog_session_images(session_id);

CREATE INDEX IF NOT EXISTS idx_oplog_days_date 
    ON oplog_days(log_date);

-- ============================================
-- RLS Policies (DEMO MODE - OPEN ACCESS)
-- TODO: Restrict after implementing auth
-- ============================================

-- Enable RLS on all tables
ALTER TABLE oplog_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE oplog_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE oplog_session_images ENABLE ROW LEVEL SECURITY;

-- DEMO: Allow all operations for anonymous users
-- WARNING: Replace these with proper auth-based policies before production!

-- oplog_days policies
CREATE POLICY "Allow all read on oplog_days" ON oplog_days
    FOR SELECT USING (true);

CREATE POLICY "Allow all insert on oplog_days" ON oplog_days
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all update on oplog_days" ON oplog_days
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow all delete on oplog_days" ON oplog_days
    FOR DELETE USING (true);

-- oplog_sessions policies
CREATE POLICY "Allow all read on oplog_sessions" ON oplog_sessions
    FOR SELECT USING (true);

CREATE POLICY "Allow all insert on oplog_sessions" ON oplog_sessions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all update on oplog_sessions" ON oplog_sessions
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow all delete on oplog_sessions" ON oplog_sessions
    FOR DELETE USING (true);

-- oplog_session_images policies
CREATE POLICY "Allow all read on oplog_session_images" ON oplog_session_images
    FOR SELECT USING (true);

CREATE POLICY "Allow all insert on oplog_session_images" ON oplog_session_images
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all update on oplog_session_images" ON oplog_session_images
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow all delete on oplog_session_images" ON oplog_session_images
    FOR DELETE USING (true);

-- ============================================
-- Storage Bucket Configuration
-- Run this in Supabase Dashboard > Storage
-- ============================================
-- 1. Create bucket: oplog-images
-- 2. Set to Public (for demo) or Private (production)
-- 3. Path pattern: oplog-images/{log_date}/{shift}/{session_id}/{filename}

-- ============================================
-- TODO: Production RLS Policies
-- ============================================
-- After implementing Supabase Auth:
-- 
-- 1. Create a teams table to associate users with teams
-- 2. Replace the above policies with:
--
-- CREATE POLICY "Users can read their team's data" ON oplog_days
--     FOR SELECT USING (
--         EXISTS (
--             SELECT 1 FROM team_members 
--             WHERE team_members.user_id = auth.uid()
--             AND team_members.team_id = oplog_days.team_id
--         )
--     );
--
-- Similar policies for INSERT, UPDATE, DELETE with team-based access
