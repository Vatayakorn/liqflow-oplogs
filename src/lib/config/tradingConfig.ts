/**
 * Trading Configuration
 * Dropdown options and defaults for trading operation logs
 */

// Team Members (for Broker, Trader, Head, Recorder dropdowns)
export const TEAM_MEMBERS = [
    { value: 'NAME', label: 'NAME' },
    { value: 'WIM', label: 'WIM' },
    { value: 'YEE', label: 'YEE' },
    { value: 'TAN', label: 'TAN' },
    { value: 'AOM', label: 'AOM' },
    { value: 'BIRD', label: 'BIRD' },
    { value: 'FOURWHEEL', label: 'FOURWHEEL' },
] as const;

// Session Shifts
export const SHIFTS = [
    { value: 'A', label: 'Session A', start: '06:00', end: '15:00' },
    { value: 'B', label: 'Session B', start: '14:00', end: '23:00' },
    { value: 'C', label: 'Session C', start: '22:00', end: '07:00' },
] as const;

// OTC Customer Sources
export const OTC_SOURCES = [
    { value: 'BTZ', label: 'BTZ' },
    { value: 'BTZ RFQ', label: 'BTZ RFQ' },
    { value: 'MB RFQ', label: 'MB RFQ' },
    { value: 'Maxbit', label: 'Maxbit' },
    { value: 'Other', label: 'Other' },
] as const;

// Exchange Options (Bitkub and BinanceTH only)
export const EXCHANGES = [
    { value: 'Bitkub', label: 'Bitkub' },
    { value: 'BinanceTH', label: 'Binance TH' },
] as const;

// Broker Options
export const BROKERS = [
    { value: 'BTZ', label: 'BTZ (Maxbit)' },
] as const;

// Broker Metadata (for Logos and Display)
export const BROKER_METADATA: Record<string, { logo: string; label: string }> = {
    Bitazza: {
        logo: '/images/brokers/bitazza.png',
        label: 'Bitazza',
    },
    Maxbit: {
        logo: '/images/brokers/maxbit.webp',
        label: 'Maxbit',
    },
    Xspring: {
        logo: '/images/brokers/xspring.jpeg',
        label: 'Xspring',
    },
    Zcom: {
        logo: '/images/brokers/zcom.png',
        label: 'Zcom',
    },
    BinanceTH: {
        logo: '/images/brokers/binanceth.webp',
        label: 'Binance TH',
    },
    Bitkub: {
        logo: '/images/brokers/bitkub.png',
        label: 'Bitkub',
    },
    Google: {
        logo: '/images/brokers/google.png',
        label: 'Google',
    },
};

// Transaction Actions
export const OTC_ACTIONS = [
    { value: 'BUY', label: 'Buy', color: '#34C759' },
    { value: 'SELL', label: 'Sell', color: '#FF3B30' },
] as const;

// Prefund Defaults
export const PREFUND_DEFAULTS = {
    target: 760000, // 760K USDT
    currency: 'USDT',
};

// Market Status Options
export const MARKET_STATUS = [
    { value: 'normal', label: 'Normal' },
    { value: 'volatile', label: 'Volatile' },
    { value: 'sideways', label: 'Sideways' },
    { value: 'uptrend', label: 'Uptrend' },
    { value: 'downtrend', label: 'Downtrend' },
] as const;

// Types
export type OtcSource = typeof OTC_SOURCES[number]['value'];
export type Exchange = typeof EXCHANGES[number]['value'];
export type OtcAction = typeof OTC_ACTIONS[number]['value'];
export type MarketStatus = typeof MARKET_STATUS[number]['value'];

export interface OtcTransaction {
    id: string;
    source: OtcSource;
    customerName: string;
    action: OtcAction;
    amount: number;
    currency: 'USDT' | 'USDC' | 'THB';
    rate: number;
    timestamp?: string;
    status?: string;
    total?: number;
    txnType?: string;
}

export interface ExchangeComparison {
    exchange1: Exchange;
    exchange1Price: string;
    exchange2: Exchange;
    exchange2Price: string;
    diff: string;
    higherExchange: Exchange | null;
}
