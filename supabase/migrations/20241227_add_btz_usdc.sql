-- Add USDC price columns to oplog_sessions
ALTER TABLE oplog_sessions
ADD COLUMN btz_usdc_bid numeric,
ADD COLUMN btz_usdc_ask numeric;

-- Comment on columns for clarity
COMMENT ON COLUMN oplog_sessions.btz_usdc_bid IS 'Bitazza USDC BID rate';
COMMENT ON COLUMN oplog_sessions.btz_usdc_ask IS 'Bitazza USDC ASK rate';
