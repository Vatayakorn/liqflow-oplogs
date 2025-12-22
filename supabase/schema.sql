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
    shift TEXT NOT NULL CHECK (shift IN ('A', 'B', 'C')) DEFAULT 'A',
    preset_key TEXT NULL,
    start_time TIME NOT NULL,
    end_time TIME NULL,
    
    -- Team info
    broker TEXT NOT NULL,
    trader TEXT NOT NULL,
    head TEXT NOT NULL,
    recorder TEXT NULL,
    
    -- FX tracking
    fx_rate NUMERIC NULL,
    fx_notes TEXT NULL,
    
    -- Broker (Maxbit/BTZ) info
    btz_bid NUMERIC NULL,
    btz_ask NUMERIC NULL,
    btz_notes TEXT NULL,
    
    -- Exchange comparison
    exchange1 TEXT NULL,
    exchange1_price TEXT NULL,
    exchange2 TEXT NULL,
    exchange2_price TEXT NULL,
    exchange_diff TEXT NULL,
    exchange_higher TEXT NULL,
    exchange_notes TEXT NULL,
    
    -- OTC Operations
    otc_transactions JSONB NULL DEFAULT '[]',
    prefund_current NUMERIC NULL,
    prefund_target NUMERIC NULL,
    matching_notes TEXT NULL,
    otc_notes TEXT NULL,

    -- Market Snapshot Context (Full Depth)
    market_context JSONB NULL DEFAULT '{}',
    
    -- Old fields (deprecated but kept for compatibility if needed)
    market_mode TEXT NULL,
    inventory_status TEXT NULL,
    risk_flag TEXT NULL,
    execution_issue TEXT NULL,
    pnl_snapshot NUMERIC NULL,
    action_taken TEXT NULL,
    
    -- General
    note TEXT NOT NULL DEFAULT '',
    
    -- Edit History (Change Log)
    edit_history JSONB NULL DEFAULT '[]',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: market_data
-- Real-time 1s snapshots from Python Bridge
-- ============================================
CREATE TABLE IF NOT EXISTS market_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Source of data
    source TEXT NOT NULL, -- 'bitkub', 'binance_th', 'maxbit', 'fx'
    symbol TEXT NOT NULL, -- 'USDT_THB', 'USD_THB', etc.
    
    -- Price Data
    price NUMERIC NULL,       -- Last price / Rate
    bid NUMERIC NULL,        -- Best Bid
    ask NUMERIC NULL,        -- Best Ask
    
    -- Depth Data (JSON)
    -- Structure: { 
    --   bids: [[price1, vol1], [price2, vol2], [price3, vol3], [price4, vol4], [price5, vol5]], 
    --   asks: [[price1, vol1], [price2, vol2], [price3, vol3], [price4, vol4], [price5, vol5]] 
    -- }
    order_book JSONB NULL,
    
    -- Raw API Response (Optional, for debugging)
    raw_data JSONB NULL
);

-- Minute-level statistical view (for Trend Charts)
CREATE OR REPLACE VIEW market_stats_1m AS
SELECT 
    date_trunc('minute', created_at) AS bucket,
    source,
    symbol,
    AVG(price) AS avg_price,
    AVG(bid) AS avg_bid,
    AVG(ask) AS avg_ask
FROM market_data
GROUP BY bucket, source, symbol;

-- Spread Trend view (Bitkub vs BinanceTH)
CREATE OR REPLACE VIEW spread_trend_1m AS
SELECT 
    b.bucket,
    b.avg_price AS bitkub_price,
    bn.avg_price AS binance_price,
    (b.avg_price - bn.avg_price) AS spread,
    ABS(b.avg_price - bn.avg_price) AS abs_spread
FROM market_stats_1m b
JOIN market_stats_1m bn ON b.bucket = bn.bucket
WHERE b.source = 'bitkub' AND bn.source = 'binance_th';

-- Prefund History view (Daily)
CREATE OR REPLACE VIEW prefund_history_daily AS
SELECT 
    d.log_date,
    AVG(s.prefund_current) as avg_current,
    AVG(s.prefund_target) as avg_target,
    MAX(s.prefund_current) as max_current,
    MIN(s.prefund_current) as min_current
FROM oplog_sessions s
JOIN oplog_days d ON s.day_id = d.id
GROUP BY d.log_date
ORDER BY d.log_date ASC;

-- Index for fast retrieval of latest data
CREATE INDEX IF NOT EXISTS idx_market_data_source_created 
    ON market_data(source, created_at DESC);

-- ENABLE REALTIME: Run this command in Supabase SQL Editor
-- ALTER PUBLICATION supabase_realtime ADD TABLE market_data;

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
ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;

-- DEMO: Allow all operations for anonymous users
-- WARNING: Replace these with proper auth-based policies before production!

-- oplog_days policies
DROP POLICY IF EXISTS "Allow all read on oplog_days" ON oplog_days;
CREATE POLICY "Allow all read on oplog_days" ON oplog_days
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all insert on oplog_days" ON oplog_days;
CREATE POLICY "Allow all insert on oplog_days" ON oplog_days
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all update on oplog_days" ON oplog_days;
CREATE POLICY "Allow all update on oplog_days" ON oplog_days
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all delete on oplog_days" ON oplog_days;
CREATE POLICY "Allow all delete on oplog_days" ON oplog_days
    FOR DELETE USING (true);

-- oplog_sessions policies
DROP POLICY IF EXISTS "Allow all read on oplog_sessions" ON oplog_sessions;
CREATE POLICY "Allow all read on oplog_sessions" ON oplog_sessions
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all insert on oplog_sessions" ON oplog_sessions;
CREATE POLICY "Allow all insert on oplog_sessions" ON oplog_sessions
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all update on oplog_sessions" ON oplog_sessions;
CREATE POLICY "Allow all update on oplog_sessions" ON oplog_sessions
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all delete on oplog_sessions" ON oplog_sessions;
CREATE POLICY "Allow all delete on oplog_sessions" ON oplog_sessions
    FOR DELETE USING (true);

-- market_data policies
DROP POLICY IF EXISTS "Allow all read on market_data" ON market_data;
CREATE POLICY "Allow all read on market_data" ON market_data
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all insert on market_data" ON market_data;
CREATE POLICY "Allow all insert on market_data" ON market_data
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all update on market_data" ON market_data;
CREATE POLICY "Allow all update on market_data" ON market_data
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all delete on market_data" ON market_data;
CREATE POLICY "Allow all delete on market_data" ON market_data
    FOR DELETE USING (true);

-- oplog_session_images policies
DROP POLICY IF EXISTS "Allow all read on oplog_session_images" ON oplog_session_images;
CREATE POLICY "Allow all read on oplog_session_images" ON oplog_session_images
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all insert on oplog_session_images" ON oplog_session_images;
CREATE POLICY "Allow all insert on oplog_session_images" ON oplog_session_images
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all update on oplog_session_images" ON oplog_session_images;
CREATE POLICY "Allow all update on oplog_session_images" ON oplog_session_images
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all delete on oplog_session_images" ON oplog_session_images;
CREATE POLICY "Allow all delete on oplog_session_images" ON oplog_session_images
    FOR DELETE USING (true);

-- ============================================
-- Storage Bucket Configuration
-- ============================================
-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('oplog-images', 'oplog-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies (storage.objects)
-- READ
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'oplog-images' );

-- UPLOAD
DROP POLICY IF EXISTS "Public Upload" ON storage.objects;
CREATE POLICY "Public Upload"
  ON storage.objects FOR INSERT
  WITH CHECK ( bucket_id = 'oplog-images' );

-- DELETE
DROP POLICY IF EXISTS "Public Delete" ON storage.objects;
CREATE POLICY "Public Delete"
  ON storage.objects FOR DELETE
  USING ( bucket_id = 'oplog-images' );

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
-- ============================================
-- Audio Storage Bucket Configuration
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('oplog-audio', 'oplog-audio', true)
ON CONFLICT (id) DO NOTHING;

-- READ Audio
DROP POLICY IF EXISTS "Public Audio Access" ON storage.objects;
CREATE POLICY "Public Audio Access"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'oplog-audio' );

-- UPLOAD Audio
DROP POLICY IF EXISTS "Public Audio Upload" ON storage.objects;
CREATE POLICY "Public Audio Upload"
  ON storage.objects FOR INSERT
  WITH CHECK ( bucket_id = 'oplog-audio' );

-- DELETE Audio
DROP POLICY IF EXISTS "Public Audio Delete" ON storage.objects;
CREATE POLICY "Public Audio Delete"
  ON storage.objects FOR DELETE
  USING ( bucket_id = 'oplog-audio' );


-- ============================================
-- Table: Audio Metadata
-- ============================================
CREATE TABLE IF NOT EXISTS oplog_session_audio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    session_id UUID REFERENCES oplog_sessions(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    duration_seconds NUMERIC NULL,
    transcript TEXT NULL,
    notes TEXT NULL
);

-- RLS
ALTER TABLE oplog_session_audio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all read on oplog_session_audio" ON oplog_session_audio;
CREATE POLICY "Allow all read on oplog_session_audio" ON oplog_session_audio FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all insert on oplog_session_audio" ON oplog_session_audio;
CREATE POLICY "Allow all insert on oplog_session_audio" ON oplog_session_audio FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all delete on oplog_session_audio" ON oplog_session_audio;
CREATE POLICY "Allow all delete on oplog_session_audio" ON oplog_session_audio FOR DELETE USING (true);
