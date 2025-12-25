-- Add broker_prices, fx_prices, maxbit_prices, bitazza_prices, zcom_prices, xspring_prices columns
-- These columns store arrays of price entries as JSONB

ALTER TABLE oplog_sessions 
ADD COLUMN IF NOT EXISTS broker_prices JSONB DEFAULT '[]';

ALTER TABLE oplog_sessions 
ADD COLUMN IF NOT EXISTS fx_prices JSONB DEFAULT '[]';

ALTER TABLE oplog_sessions 
ADD COLUMN IF NOT EXISTS maxbit_prices JSONB DEFAULT '[]';

ALTER TABLE oplog_sessions 
ADD COLUMN IF NOT EXISTS bitazza_prices JSONB DEFAULT '[]';

ALTER TABLE oplog_sessions 
ADD COLUMN IF NOT EXISTS zcom_prices JSONB DEFAULT '[]';

ALTER TABLE oplog_sessions 
ADD COLUMN IF NOT EXISTS xspring_prices JSONB DEFAULT '[]';

ALTER TABLE oplog_sessions 
ADD COLUMN IF NOT EXISTS exchange_prices JSONB DEFAULT '[]';

-- Add comments for documentation
COMMENT ON COLUMN oplog_sessions.broker_prices IS 'Array of broker price entries with structure: {id, broker, bid, ask, note?, timestamp}';
COMMENT ON COLUMN oplog_sessions.fx_prices IS 'Array of FX rate entries with structure: {id, rate, note?, timestamp}';
COMMENT ON COLUMN oplog_sessions.maxbit_prices IS 'Array of Maxbit price entries with structure: {id, bid, ask, note?, timestamp}';
COMMENT ON COLUMN oplog_sessions.bitazza_prices IS 'Array of Bitazza price entries with structure: {id, bid, ask, note?, timestamp}';
COMMENT ON COLUMN oplog_sessions.zcom_prices IS 'Array of Zcom price entries with structure: {id, bid, ask, note?, timestamp}';
COMMENT ON COLUMN oplog_sessions.xspring_prices IS 'Array of Xspring price entries with structure: {id, bid, ask, note?, timestamp}';
COMMENT ON COLUMN oplog_sessions.exchange_prices IS 'Array of Exchange Order Book entries with structure: {id, exchange1, exchange1Bid, exchange1Ask, exchange2, exchange2Bid, exchange2Ask, diff, higher, note?, timestamp}';
