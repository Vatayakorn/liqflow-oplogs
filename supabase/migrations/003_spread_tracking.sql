-- ============================================
-- Spread Tracking Schema
-- Migration: 003_spread_tracking.sql
-- ============================================

-- ============================================
-- Table: referrer_config
-- Configuration for each referrer's fee and share
-- ============================================
CREATE TABLE IF NOT EXISTS referrer_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_name TEXT UNIQUE NOT NULL,
    bitazza_fee NUMERIC DEFAULT 0.01,    -- THB per USDT, adjustable per person
    profit_share NUMERIC DEFAULT 0.5,    -- 50% of net profit goes to referrer
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by name
CREATE INDEX IF NOT EXISTS idx_referrer_config_name 
    ON referrer_config(referrer_name);

-- ============================================
-- Table: spread_records
-- Per-transaction spread tracking
-- ============================================
CREATE TABLE IF NOT EXISTS spread_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES oplog_sessions(id) ON DELETE SET NULL,
    transaction_id TEXT NOT NULL,
    referrer_name TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('BUY', 'SELL')),
    amount NUMERIC NOT NULL,
    
    -- Prices at the time of transaction
    op_spread TEXT NOT NULL,              -- e.g. "0.03/0.04"
    exchange_bid NUMERIC NOT NULL,        -- Binance TH Bid
    exchange_ask NUMERIC NOT NULL,        -- Binance TH Ask
    customer_rate NUMERIC NOT NULL,       -- Rate customer got
    
    -- Calculated values
    real_spread NUMERIC NOT NULL,         -- Actual spread per USDT
    bitazza_deduct NUMERIC NOT NULL,      -- Fee deducted per USDT
    net_profit NUMERIC NOT NULL,          -- Total profit in THB
    referrer_payout NUMERIC NOT NULL,     -- Amount to pay referrer in THB
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_spread_records_session 
    ON spread_records(session_id);
CREATE INDEX IF NOT EXISTS idx_spread_records_referrer 
    ON spread_records(referrer_name);
CREATE INDEX IF NOT EXISTS idx_spread_records_created 
    ON spread_records(created_at DESC);

-- ============================================
-- RLS Policies (Open Access for now)
-- ============================================
ALTER TABLE referrer_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE spread_records ENABLE ROW LEVEL SECURITY;

-- referrer_config policies
DROP POLICY IF EXISTS "Allow all read on referrer_config" ON referrer_config;
CREATE POLICY "Allow all read on referrer_config" ON referrer_config
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all insert on referrer_config" ON referrer_config;
CREATE POLICY "Allow all insert on referrer_config" ON referrer_config
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all update on referrer_config" ON referrer_config;
CREATE POLICY "Allow all update on referrer_config" ON referrer_config
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all delete on referrer_config" ON referrer_config;
CREATE POLICY "Allow all delete on referrer_config" ON referrer_config
    FOR DELETE USING (true);

-- spread_records policies
DROP POLICY IF EXISTS "Allow all read on spread_records" ON spread_records;
CREATE POLICY "Allow all read on spread_records" ON spread_records
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all insert on spread_records" ON spread_records;
CREATE POLICY "Allow all insert on spread_records" ON spread_records
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all update on spread_records" ON spread_records;
CREATE POLICY "Allow all update on spread_records" ON spread_records
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all delete on spread_records" ON spread_records;
CREATE POLICY "Allow all delete on spread_records" ON spread_records
    FOR DELETE USING (true);

-- ============================================
-- View: payout_summary_by_referrer
-- Aggregate payouts by referrer
-- ============================================
CREATE OR REPLACE VIEW payout_summary_by_referrer AS
SELECT 
    referrer_name,
    COUNT(*) as total_transactions,
    SUM(amount) as total_volume,
    SUM(net_profit) as total_net_profit,
    SUM(referrer_payout) as total_payout,
    DATE(created_at) as record_date
FROM spread_records
GROUP BY referrer_name, DATE(created_at)
ORDER BY record_date DESC, total_payout DESC;
