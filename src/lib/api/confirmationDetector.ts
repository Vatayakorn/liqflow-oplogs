/**
 * Confirmation Detector Utility
 * Detects quote requests, rate offers, confirmations, and send-back patterns from chat messages
 */

import type { ChatMessage } from './chatlog';

// ============================================
// Types
// ============================================

export interface QuoteRequest {
    customerName: string;
    action: 'BUY' | 'SELL';
    timestamp: string;
    messageId: number;
    rawMessage: string;
}

export interface RateOffer {
    customerName: string;
    action: 'BUY' | 'SELL';
    rate: number;
    liquidity: string;
    timestamp: string;
    messageId: number;
}

export interface Confirmation {
    customerName: string;
    action: 'BUY' | 'SELL';
    amount: number;
    rate: number;
    timestamp: string;
    messageId: number;
    rawMessage: string;
}

export interface LiqflowSendBack {
    action: 'BUY' | 'SELL';
    amount: number;
    rate: number;
    timestamp: string;
    messageId: number;
}

export interface CustomerQuoteMetrics {
    customerName: string;
    quoteCount: number;
    confirmationCount: number;
    quoteToConfirmRatio: number;
    avgTimeToDecisionMinutes: number | null;
    quotes: QuoteRequest[];
    confirmations: Confirmation[];
    rateOffers: RateOffer[];
}

// ============================================
// Regex Patterns
// ============================================

/**
 * Quote Request Pattern
 * Examples: "Vadim sell rate", "Xiao buy", "24 ex sell"
 * Pattern: [Name] [sell/buy] [rate?]
 */
const QUOTE_REQUEST_REGEX = /^([A-Za-z0-9\s]+?)\s+(sell|buy)(?:\s+rate)?$/i;

/**
 * Rate Offer Pattern
 * Example:
 * 📢 Rate Offer 📢
 * • Client: Vadim
 * • Type: SELL (BID)
 * • Rate: 31.10
 * • Liquidity: LF liq
 */
const RATE_OFFER_REGEX = /📢\s*Rate Offer\s*📢[\s\S]*?•\s*Client:\s*(.+?)[\n\r][\s\S]*?•\s*Type:\s*(SELL|BUY)[\s\S]*?•\s*Rate:\s*([\d.]+)[\s\S]*?•\s*Liquidity:\s*(.+?)(?:[\n\r]|$)/i;

/**
 * Confirmation Pattern
 * Example: "Vadim CF SELL 70,762.31 USDT at 31.090"
 * Pattern: [Name] CF [SELL/BUY] [Amount] USDT at [Rate]
 */
const CONFIRMATION_REGEX = /([A-Za-z0-9\s]+?)\s+CF\s+(SELL|BUY)\s+([\d,]+(?:\.\d+)?)\s*USDT\s+at\s+([\d.]+)/i;

/**
 * Liqflow Send Back Pattern
 * Example: "Liqflow Send Back BUY 70,762.31 USDT at 31.100"
 * Pattern: Liqflow Send Back [BUY/SELL] [Amount] USDT at [Rate]
 */
const SEND_BACK_REGEX = /Liqflow\s+Send\s+Back\s+(BUY|SELL)\s+([\d,]+(?:\.\d+)?)\s*USDT\s+at\s+([\d.]+)/i;

// ============================================
// Detection Functions
// ============================================

/**
 * Detect Quote Request from message text
 */
export function detectQuoteRequest(message: ChatMessage): QuoteRequest | null {
    if (!message.message_text) return null;

    const text = message.message_text.trim();
    const match = text.match(QUOTE_REQUEST_REGEX);

    if (match) {
        return {
            customerName: match[1].trim(),
            action: match[2].toUpperCase() as 'BUY' | 'SELL',
            timestamp: message.created_at,
            messageId: message.id,
            rawMessage: text
        };
    }

    return null;
}

/**
 * Detect Rate Offer from message text
 */
export function detectRateOffer(message: ChatMessage): RateOffer | null {
    if (!message.message_text) return null;

    const text = message.message_text;
    const match = text.match(RATE_OFFER_REGEX);

    if (match) {
        return {
            customerName: match[1].trim(),
            action: match[2].toUpperCase() as 'BUY' | 'SELL',
            rate: parseFloat(match[3]),
            liquidity: match[4].trim(),
            timestamp: message.created_at,
            messageId: message.id
        };
    }

    return null;
}

/**
 * Detect Confirmation from message text
 */
export function detectConfirmation(message: ChatMessage): Confirmation | null {
    if (!message.message_text) return null;

    const text = message.message_text.trim();
    const match = text.match(CONFIRMATION_REGEX);

    if (match) {
        // Parse amount: remove commas and convert to number
        const amountStr = match[3].replace(/,/g, '');

        return {
            customerName: match[1].trim(),
            action: match[2].toUpperCase() as 'BUY' | 'SELL',
            amount: parseFloat(amountStr),
            rate: parseFloat(match[4]),
            timestamp: message.created_at,
            messageId: message.id,
            rawMessage: text
        };
    }

    return null;
}

/**
 * Detect Liqflow Send Back from message text
 */
export function detectSendBack(message: ChatMessage): LiqflowSendBack | null {
    if (!message.message_text) return null;

    const text = message.message_text.trim();
    const match = text.match(SEND_BACK_REGEX);

    if (match) {
        const amountStr = match[2].replace(/,/g, '');

        return {
            action: match[1].toUpperCase() as 'BUY' | 'SELL',
            amount: parseFloat(amountStr),
            rate: parseFloat(match[3]),
            timestamp: message.created_at,
            messageId: message.id
        };
    }

    return null;
}

/**
 * Analyze all messages and extract patterns
 */
export function analyzeMessages(messages: ChatMessage[]): {
    quoteRequests: QuoteRequest[];
    rateOffers: RateOffer[];
    confirmations: Confirmation[];
    sendBacks: LiqflowSendBack[];
} {
    const quoteRequests: QuoteRequest[] = [];
    const rateOffers: RateOffer[] = [];
    const confirmations: Confirmation[] = [];
    const sendBacks: LiqflowSendBack[] = [];

    for (const msg of messages) {
        // Try to detect each pattern
        const quote = detectQuoteRequest(msg);
        if (quote) {
            quoteRequests.push(quote);
            continue; // Move to next message once matched
        }

        const offer = detectRateOffer(msg);
        if (offer) {
            rateOffers.push(offer);
            continue;
        }

        const cf = detectConfirmation(msg);
        if (cf) {
            confirmations.push(cf);
            continue;
        }

        const sendBack = detectSendBack(msg);
        if (sendBack) {
            sendBacks.push(sendBack);
        }
    }

    return { quoteRequests, rateOffers, confirmations, sendBacks };
}

/**
 * Calculate quote-to-confirmation metrics for a specific customer
 * Optionally reconciles detections with actual transactions for better accuracy
 */
export function calculateCustomerMetrics(
    customerName: string,
    analysis: ReturnType<typeof analyzeMessages>,
    actualTransactions: any[] = [] // Optional: Transactions from the API
): CustomerQuoteMetrics {
    const searchName = customerName.toLowerCase().trim();

    // Filter for this customer
    const customerQuotes = analysis.quoteRequests.filter(q => {
        const name = q.customerName.toLowerCase();
        if (searchName.length <= 2) return name === searchName;
        return name.includes(searchName) || searchName.includes(name);
    });

    const parsedConfirms = analysis.confirmations.filter(c => {
        const name = c.customerName.toLowerCase();
        if (searchName.length <= 2) return name === searchName;
        return name.includes(searchName) || searchName.includes(name);
    });

    const customerOffers = analysis.rateOffers.filter(o => {
        const name = o.customerName.toLowerCase();
        if (searchName.length <= 2) return name === searchName;
        return name.includes(searchName) || searchName.includes(name);
    });

    // Reconcile confirmations with actual transactions from the API
    const customerConfirms: Confirmation[] = parsedConfirms.map(cf => {
        // Find matching transaction in the API data
        // Match by amount (within 0.1%) and rate (within 0.01) and time (within 1 hour)
        const cfTime = new Date(cf.timestamp).getTime();

        const match = actualTransactions.find(tx => {
            const txTime = new Date(tx.date || tx.transaction_date).getTime();
            const timeDiffMins = Math.abs(txTime - cfTime) / (1000 * 60);

            // Allow 60 mins window (due to timezone shifts or long settlement)
            if (timeDiffMins > 60) return false;

            const amountDiff = Math.abs(tx.amount - cf.amount);
            const rateDiff = Math.abs(tx.rate - cf.rate);

            // Loose match on amount/rate to handle rounding
            return (amountDiff < 0.1) && (rateDiff < 0.005);
        });

        if (match) {
            console.log(`[Reconciliation] Found match for ${customerName}: CF ${cf.action} ${cf.amount} @${cf.rate} -> API ${match.action} ${match.amount} @${match.rate}`);
            return {
                ...cf,
                action: match.action.toUpperCase() as 'BUY' | 'SELL',
                // Use API time as the source of truth if matched
                timestamp: match.date || match.transaction_date || cf.timestamp
            };
        }

        return cf;
    });

    const quoteCount = customerQuotes.length;
    const confirmCount = customerConfirms.length;
    const ratio = quoteCount > 0 ? confirmCount / quoteCount : 0;

    // Calculate average time to decision
    let avgTime: number | null = null;
    if (customerQuotes.length > 0 && customerConfirms.length > 0) {
        const times: number[] = [];

        // For each confirmation, find the closest preceding quote
        for (const cf of customerConfirms) {
            const cfTime = new Date(cf.timestamp).getTime();

            // Find quotes that came before this confirmation
            const precedingQuotes = customerQuotes.filter(
                q => new Date(q.timestamp).getTime() < cfTime
            );

            if (precedingQuotes.length > 0) {
                // Get the most recent quote before confirmation
                const closestQuote = precedingQuotes.reduce((prev, curr) => {
                    const prevTime = new Date(prev.timestamp).getTime();
                    const currTime = new Date(curr.timestamp).getTime();
                    return currTime > prevTime ? curr : prev;
                });

                const quoteTime = new Date(closestQuote.timestamp).getTime();
                const diffMinutes = (cfTime - quoteTime) / (1000 * 60);

                // Only count if within reasonable window (1 hour)
                if (diffMinutes <= 60) {
                    times.push(diffMinutes);
                }
            }
        }

        if (times.length > 0) {
            avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        }
    }

    return {
        customerName,
        quoteCount,
        confirmationCount: confirmCount,
        quoteToConfirmRatio: ratio,
        avgTimeToDecisionMinutes: avgTime,
        quotes: customerQuotes,
        confirmations: customerConfirms,
        rateOffers: customerOffers
    };
}

/**
 * Get all unique customer names from analysis
 */
export function getUniqueCustomers(analysis: ReturnType<typeof analyzeMessages>): string[] {
    const names = new Set<string>();

    analysis.quoteRequests.forEach(q => names.add(q.customerName.toLowerCase()));
    analysis.confirmations.forEach(c => names.add(c.customerName.toLowerCase()));
    analysis.rateOffers.forEach(o => names.add(o.customerName.toLowerCase()));

    return Array.from(names);
}
