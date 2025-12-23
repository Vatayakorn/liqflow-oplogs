-- Migration: Customer Analytics Table
-- สำหรับเก็บการวิเคราะห์พฤติกรรมลูกค้าจาก chat และ OTC transactions

-- =============================================
-- Customer Analytics Table
-- =============================================

CREATE TABLE IF NOT EXISTS customer_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Customer Identification
    customer_name TEXT NOT NULL UNIQUE,  -- ชื่อลูกค้าจาก OTC transactions
    display_name TEXT,                    -- ชื่อที่ใช้แสดง (อาจ normalize มาแล้ว)
    
    -- Behavior Classification
    behavior_type TEXT NOT NULL DEFAULT 'new_prospect' 
        CHECK (behavior_type IN ('hot_lead', 'negotiator', 'window_shopper', 'ghost', 'vip_repeat', 'new_prospect')),
    engagement_score DECIMAL(3,2) DEFAULT 0.50,  -- 0.00 - 1.00
    
    -- Transaction Metrics
    total_transactions INTEGER DEFAULT 0,
    total_volume NUMERIC DEFAULT 0,           -- ยอดซื้อ/ขายรวม (USDT)
    avg_transaction_size NUMERIC DEFAULT 0,
    last_transaction_date TIMESTAMPTZ,
    
    -- Chat Metrics  
    total_messages INTEGER DEFAULT 0,
    first_contact TIMESTAMPTZ,
    last_contact TIMESTAMPTZ,
    avg_response_time_minutes INTEGER,        -- เวลาตอบโดยเฉลี่ย
    
    -- AI Analysis
    sentiment TEXT DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    ai_summary TEXT,
    recommendations JSONB DEFAULT '[]',       -- คำแนะนำจาก AI
    risk_flags JSONB DEFAULT '[]',            -- ธงเตือน
    key_topics JSONB DEFAULT '[]',            -- หัวข้อที่คุยบ่อย
    
    -- Alert Status
    needs_followup BOOLEAN DEFAULT false,
    followup_reason TEXT,
    followup_priority TEXT DEFAULT 'normal' CHECK (followup_priority IN ('low', 'normal', 'high', 'urgent')),
    last_followup_at TIMESTAMPTZ,
    
    -- AI Provider Info
    provider TEXT CHECK (provider IN ('openai', 'gemini')),
    model TEXT,
    
    -- Timestamps
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Indexes
-- =============================================

-- Fast lookup by customer name
CREATE INDEX IF NOT EXISTS idx_customer_analytics_name 
ON customer_analytics(customer_name);

-- Filter by behavior type
CREATE INDEX IF NOT EXISTS idx_customer_analytics_behavior 
ON customer_analytics(behavior_type);

-- Find customers needing followup
CREATE INDEX IF NOT EXISTS idx_customer_analytics_followup 
ON customer_analytics(needs_followup, followup_priority) 
WHERE needs_followup = true;

-- Sort by last transaction
CREATE INDEX IF NOT EXISTS idx_customer_analytics_last_tx 
ON customer_analytics(last_transaction_date DESC);

-- Sort by engagement score
CREATE INDEX IF NOT EXISTS idx_customer_analytics_engagement 
ON customer_analytics(engagement_score DESC);

-- =============================================
-- Row Level Security
-- =============================================

ALTER TABLE customer_analytics ENABLE ROW LEVEL SECURITY;

-- Allow all operations (adjust as needed for your auth setup)
CREATE POLICY "Allow all for authenticated users" ON customer_analytics
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Grant access
GRANT ALL ON customer_analytics TO authenticated;
GRANT ALL ON customer_analytics TO anon;

-- =============================================
-- Trigger for updated_at
-- =============================================

CREATE OR REPLACE FUNCTION update_customer_analytics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customer_analytics_updated_at
    BEFORE UPDATE ON customer_analytics
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_analytics_updated_at();

-- =============================================
-- Comments
-- =============================================

COMMENT ON TABLE customer_analytics IS 'AI-powered customer behavior analytics from chat and OTC transactions';
COMMENT ON COLUMN customer_analytics.behavior_type IS 'Customer classification: hot_lead, negotiator, window_shopper, ghost, vip_repeat, new_prospect';
COMMENT ON COLUMN customer_analytics.engagement_score IS 'AI-calculated engagement score from 0.00 to 1.00';
COMMENT ON COLUMN customer_analytics.needs_followup IS 'Flag for customers requiring immediate attention';
