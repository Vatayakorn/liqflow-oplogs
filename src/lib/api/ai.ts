/**
 * AI Service Module
 * Provides AI-powered session analysis using OpenAI and Gemini
 * Supports dual provider with automatic fallback
 */

import type { OplogSession } from './oplog';
import type { ChatMessage } from './chatlog';
import { supabase } from '$lib/supabaseClient';

// ============================================
// Types
// ============================================

export interface AISessionInsights {
    totalVolume: string;
    transactionCount: number;
    dominantAction: 'BUY' | 'SELL' | 'BALANCED';
    spreadTrend: string;
}

export interface AISessionSummary {
    id?: string;
    session_id: string;
    summary: string;
    highlights: AISessionInsights;
    operationalInsights: string[];
    managementInsights: string[];
    recommendations: string[];
    riskFlags: string[];
    provider: 'openai' | 'gemini';
    model: string;
    created_at?: string;
}

// ============================================
// Configuration
// ============================================

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

const OPENAI_MODEL = 'gpt-4o-mini';
const GEMINI_MODEL = 'gemini-2.0-flash';

// ============================================
// Prompt Templates
// ============================================

function buildSessionPrompt(session: OplogSession, chatMessages: ChatMessage[]): string {
    const otcStats = calculateOtcSummary(session);
    const chatSummary = summarizeChatMessages(chatMessages);

    return `คุณเป็นผู้เชี่ยวชาญด้าน OTC Crypto Trading สำหรับตลาดไทย วิเคราะห์ Session นี้และให้ข้อมูลเชิงลึก

## ข้อมูล Session
- **Shift**: ${session.shift} (${session.start_time} - ${session.end_time || 'กำลังดำเนินการ'})
- **Broker**: ${session.broker}
- **Trader**: ${session.trader}
- **Head**: ${session.head}

## OTC Transactions
${otcStats}

## Market Context
- **FX Rate**: ${session.fx_rate || 'N/A'}
- **Broker Bid/Ask**: ${session.btz_bid || 'N/A'} / ${session.btz_ask || 'N/A'}
- **Exchange1 (${session.exchange1 || 'Bitkub'})**: ${session.exchange1_price || 'N/A'}
- **Exchange2 (${session.exchange2 || 'BinanceTH'})**: ${session.exchange2_price || 'N/A'}
- **Spread**: ${session.exchange_diff || 'N/A'} (${session.exchange_higher || 'N/A'} สูงกว่า)

## Prefund Status
- Current: ${session.prefund_current?.toLocaleString() || 'N/A'} THB
- Target: ${session.prefund_target?.toLocaleString() || 'N/A'} THB

## Chat Activity
${chatSummary}

## Notes
- Matching: ${session.matching_notes || '-'}
- OTC: ${session.otc_notes || '-'}
- General: ${session.note || '-'}

---

ตอบเป็น JSON เท่านั้น ในรูปแบบ:
{
  "summary": "สรุปภาพรวม 2-3 ประโยค ภาษาไทย",
  "highlights": {
    "totalVolume": "150K USDT",
    "transactionCount": 5,
    "dominantAction": "BUY",
    "spreadTrend": "Bitkub สูงกว่า +50 สตางค์"
  },
  "operationalInsights": ["ข้อสังเกตสำหรับทีม Operation 1", "ข้อสังเกต 2"],
  "managementInsights": ["ข้อสังเกตสำหรับผู้บริหาร 1", "ข้อสังเกต 2"],
  "recommendations": ["ข้อแนะนำ 1", "ข้อแนะนำ 2"],
  "riskFlags": ["ธงเตือนความเสี่ยง ถ้ามี"]
}`;
}

function calculateOtcSummary(session: OplogSession): string {
    const txns = session.otc_transactions || [];
    if (txns.length === 0) return 'ไม่มี OTC Transaction';

    const buyTxns = txns.filter(tx => tx.action === 'BUY');
    const sellTxns = txns.filter(tx => tx.action === 'SELL');
    const totalBuy = buyTxns.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const totalSell = sellTxns.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    let summary = `- จำนวน: ${txns.length} รายการ\n`;
    summary += `- BUY: ${buyTxns.length} รายการ (${totalBuy.toLocaleString()} USDT)\n`;
    summary += `- SELL: ${sellTxns.length} รายการ (${totalSell.toLocaleString()} USDT)\n`;
    summary += `- Volume รวม: ${(totalBuy + totalSell).toLocaleString()} USDT`;

    return summary;
}

function summarizeChatMessages(messages: ChatMessage[]): string {
    if (messages.length === 0) return 'ไม่มีข้อความ Chat';

    const userMessages = messages.filter(m => !m.from_is_bot);
    const botMessages = messages.filter(m => m.from_is_bot);

    let summary = `- ข้อความทั้งหมด: ${messages.length}\n`;
    summary += `- จาก User: ${userMessages.length}\n`;
    summary += `- จาก Bot: ${botMessages.length}\n`;

    // Extract key messages (first 5 user messages for context)
    if (userMessages.length > 0) {
        summary += '\n**ตัวอย่างข้อความ:**\n';
        userMessages.slice(0, 5).forEach(m => {
            const text = m.message_text?.substring(0, 100) || '[media]';
            summary += `- ${m.from_first_name || 'User'}: ${text}\n`;
        });
    }

    return summary;
}

// ============================================
// AI Provider Functions
// ============================================

async function callOpenAI(prompt: string): Promise<{ content: string; model: string }> {
    if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: OPENAI_MODEL,
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful assistant that analyzes OTC trading sessions. Always respond with valid JSON only.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.3,
            max_tokens: 1500,
            response_format: { type: 'json_object' }
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return {
        content: data.choices[0]?.message?.content || '',
        model: OPENAI_MODEL
    };
}

async function callGemini(prompt: string): Promise<{ content: string; model: string }> {
    if (!GEMINI_API_KEY) {
        throw new Error('Gemini API key not configured');
    }

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [{ text: prompt }]
                    }
                ],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 1500,
                    responseMimeType: 'application/json'
                }
            })
        }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { content, model: GEMINI_MODEL };
}

// ============================================
// Main API Functions
// ============================================

/**
 * Generate AI summary for a session
 * @param preferredProvider - 'openai', 'gemini', or 'auto' (tries OpenAI first, then Gemini)
 */
export async function generateSessionSummary(
    session: OplogSession,
    chatMessages: ChatMessage[],
    preferredProvider: 'openai' | 'gemini' | 'auto' = 'auto'
): Promise<AISessionSummary> {
    const prompt = buildSessionPrompt(session, chatMessages);

    let result: { content: string; model: string; provider: 'openai' | 'gemini' };

    if (preferredProvider === 'openai') {
        // User explicitly chose OpenAI
        const openaiResult = await callOpenAI(prompt);
        result = { ...openaiResult, provider: 'openai' };
    } else if (preferredProvider === 'gemini') {
        // User explicitly chose Gemini
        const geminiResult = await callGemini(prompt);
        result = { ...geminiResult, provider: 'gemini' };
    } else {
        // Auto mode: Try OpenAI first, fallback to Gemini
        try {
            const openaiResult = await callOpenAI(prompt);
            result = { ...openaiResult, provider: 'openai' };
        } catch (openaiError) {
            console.warn('OpenAI failed, trying Gemini:', openaiError);

            // Fallback to Gemini
            try {
                const geminiResult = await callGemini(prompt);
                result = { ...geminiResult, provider: 'gemini' };
            } catch (geminiError) {
                console.error('Both AI providers failed:', geminiError);
                throw new Error('Failed to generate summary. Both OpenAI and Gemini are unavailable.');
            }
        }
    }

    // Parse JSON response
    let parsed: Partial<AISessionSummary>;
    try {
        parsed = JSON.parse(result.content);
    } catch (parseError) {
        console.error('Failed to parse AI response:', result.content);
        throw new Error('AI returned invalid JSON response');
    }

    const summary: AISessionSummary = {
        session_id: session.id,
        summary: parsed.summary || 'ไม่สามารถสร้างสรุปได้',
        highlights: parsed.highlights || {
            totalVolume: '0',
            transactionCount: 0,
            dominantAction: 'BALANCED',
            spreadTrend: '-'
        },
        operationalInsights: parsed.operationalInsights || [],
        managementInsights: parsed.managementInsights || [],
        recommendations: parsed.recommendations || [],
        riskFlags: parsed.riskFlags || [],
        provider: result.provider,
        model: result.model
    };

    return summary;
}

/**
 * Save AI summary to Supabase
 */
export async function saveSessionSummary(summary: AISessionSummary): Promise<AISessionSummary> {
    const { data, error } = await supabase
        .from('session_ai_summaries')
        .upsert({
            session_id: summary.session_id,
            summary_text: summary.summary,
            insights: {
                highlights: summary.highlights,
                operationalInsights: summary.operationalInsights,
                managementInsights: summary.managementInsights,
                recommendations: summary.recommendations,
                riskFlags: summary.riskFlags
            },
            provider: summary.provider,
            model: summary.model
        }, {
            onConflict: 'session_id'
        })
        .select()
        .single();

    if (error) {
        console.error('Failed to save summary:', error);
        throw new Error(`Failed to save summary: ${error.message}`);
    }

    return {
        ...summary,
        id: data.id,
        created_at: data.created_at
    };
}

/**
 * Get existing AI summary for a session
 */
export async function getSessionSummary(sessionId: string): Promise<AISessionSummary | null> {
    const { data, error } = await supabase
        .from('session_ai_summaries')
        .select('*')
        .eq('session_id', sessionId)
        .single();

    if (error || !data) {
        return null;
    }

    return {
        id: data.id,
        session_id: data.session_id,
        summary: data.summary_text,
        highlights: data.insights?.highlights || {},
        operationalInsights: data.insights?.operationalInsights || [],
        managementInsights: data.insights?.managementInsights || [],
        recommendations: data.insights?.recommendations || [],
        riskFlags: data.insights?.riskFlags || [],
        provider: data.provider,
        model: data.model,
        created_at: data.created_at
    };
}

/**
 * Delete AI summary for a session
 */
export async function deleteSessionSummary(sessionId: string): Promise<void> {
    const { error } = await supabase
        .from('session_ai_summaries')
        .delete()
        .eq('session_id', sessionId);

    if (error) {
        throw new Error(`Failed to delete summary: ${error.message}`);
    }
}

/**
 * Check if AI providers are configured
 */
export function getAIProviderStatus(): { openai: boolean; gemini: boolean } {
    return {
        openai: !!OPENAI_API_KEY,
        gemini: !!GEMINI_API_KEY
    };
}

// ============================================
// Daily Summary Types & Functions
// ============================================

export interface ShiftStats {
    volume: number;
    count: number;
    buyVolume: number;
    sellVolume: number;
    duration: number; // minutes
}

export interface DailySummary {
    id?: string;
    log_date: string;
    totalVolume: number;
    transactionCount: number;
    buyVolume: number;
    sellVolume: number;
    shiftStats: Record<'A' | 'B' | 'C', ShiftStats>;
    summary: string;
    managementInsights: string[];
    issues: string[];
    recommendations: string[];
    bestShift: 'A' | 'B' | 'C' | null;
    provider: 'openai' | 'gemini';
    model: string;
    created_at?: string;
}

/**
 * Aggregate session stats for daily summary
 */
function aggregateDailyStats(sessions: OplogSession[]): {
    totalVolume: number;
    transactionCount: number;
    buyVolume: number;
    sellVolume: number;
    shiftStats: Record<'A' | 'B' | 'C', ShiftStats>;
    bestShift: 'A' | 'B' | 'C' | null;
} {
    const shiftStats: Record<'A' | 'B' | 'C', ShiftStats> = {
        A: { volume: 0, count: 0, buyVolume: 0, sellVolume: 0, duration: 0 },
        B: { volume: 0, count: 0, buyVolume: 0, sellVolume: 0, duration: 0 },
        C: { volume: 0, count: 0, buyVolume: 0, sellVolume: 0, duration: 0 }
    };

    let totalVolume = 0;
    let transactionCount = 0;
    let buyVolume = 0;
    let sellVolume = 0;

    sessions.forEach(session => {
        const shift = session.shift as 'A' | 'B' | 'C';
        const txns = session.otc_transactions || [];

        txns.forEach(tx => {
            const amount = tx.amount || 0;
            totalVolume += amount;
            transactionCount++;
            shiftStats[shift].volume += amount;
            shiftStats[shift].count++;

            if (tx.action === 'BUY') {
                buyVolume += amount;
                shiftStats[shift].buyVolume += amount;
            } else {
                sellVolume += amount;
                shiftStats[shift].sellVolume += amount;
            }
        });

        // Calculate duration
        if (session.start_time && session.end_time) {
            const [sh, sm] = session.start_time.split(':').map(Number);
            const [eh, em] = session.end_time.split(':').map(Number);
            let duration = (eh * 60 + em) - (sh * 60 + sm);
            if (duration < 0) duration += 24 * 60; // Handle overnight
            shiftStats[shift].duration += duration;
        }
    });

    // Find best shift by volume
    let bestShift: 'A' | 'B' | 'C' | null = null;
    let maxVolume = 0;
    (['A', 'B', 'C'] as const).forEach(shift => {
        if (shiftStats[shift].volume > maxVolume) {
            maxVolume = shiftStats[shift].volume;
            bestShift = shift;
        }
    });

    return { totalVolume, transactionCount, buyVolume, sellVolume, shiftStats, bestShift };
}

/**
 * Build prompt for daily summary
 */
function buildDailyPrompt(logDate: string, sessions: OplogSession[], stats: ReturnType<typeof aggregateDailyStats>): string {
    const formatVolume = (v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(2)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toString();

    let sessionDetails = '';
    sessions.forEach(s => {
        const txns = s.otc_transactions || [];
        sessionDetails += `- Shift ${s.shift} (${s.start_time}-${s.end_time}): ${txns.length} txns, Broker: ${s.broker}, Trader: ${s.trader}\n`;
    });

    return `คุณเป็นผู้เชี่ยวชาญด้าน OTC Trading วิเคราะห์สรุปประจำวันสำหรับผู้บริหาร

## ข้อมูลประจำวัน: ${logDate}

### สถิติรวม
- Volume รวม: ${formatVolume(stats.totalVolume)} USDT
- จำนวน Transaction: ${stats.transactionCount}
- BUY: ${formatVolume(stats.buyVolume)} USDT
- SELL: ${formatVolume(stats.sellVolume)} USDT

### Breakdown ตาม Shift
- Shift A: ${formatVolume(stats.shiftStats.A.volume)} USDT (${stats.shiftStats.A.count} txns)
- Shift B: ${formatVolume(stats.shiftStats.B.volume)} USDT (${stats.shiftStats.B.count} txns)
- Shift C: ${formatVolume(stats.shiftStats.C.volume)} USDT (${stats.shiftStats.C.count} txns)

### Sessions
${sessionDetails}

---

ตอบเป็น JSON เท่านั้น ในรูปแบบ:
{
  "summary": "สรุปภาพรวมประจำวัน 2-3 ประโยค ภาษาไทย",
  "managementInsights": ["insight สำหรับผู้บริหาร 1", "insight 2"],
  "issues": ["ปัญหาที่พบ ถ้ามี"],
  "recommendations": ["ข้อแนะนำสำหรับวันถัดไป"]
}`;
}

/**
 * Generate daily summary for all sessions of a date
 */
export async function generateDailySummary(
    logDate: string,
    sessions: OplogSession[],
    preferredProvider: 'openai' | 'gemini' | 'auto' = 'auto'
): Promise<DailySummary> {
    const stats = aggregateDailyStats(sessions);
    const prompt = buildDailyPrompt(logDate, sessions, stats);

    let result: { content: string; model: string; provider: 'openai' | 'gemini' };

    if (preferredProvider === 'openai') {
        const openaiResult = await callOpenAI(prompt);
        result = { ...openaiResult, provider: 'openai' };
    } else if (preferredProvider === 'gemini') {
        const geminiResult = await callGemini(prompt);
        result = { ...geminiResult, provider: 'gemini' };
    } else {
        try {
            const openaiResult = await callOpenAI(prompt);
            result = { ...openaiResult, provider: 'openai' };
        } catch (openaiError) {
            console.warn('OpenAI failed, trying Gemini:', openaiError);
            try {
                const geminiResult = await callGemini(prompt);
                result = { ...geminiResult, provider: 'gemini' };
            } catch (geminiError) {
                throw new Error('Failed to generate daily summary. Both AI providers unavailable.');
            }
        }
    }

    let parsed: any;
    try {
        parsed = JSON.parse(result.content);
    } catch {
        throw new Error('AI returned invalid JSON response');
    }

    return {
        log_date: logDate,
        ...stats,
        summary: parsed.summary || 'ไม่สามารถสร้างสรุปได้',
        managementInsights: parsed.managementInsights || [],
        issues: parsed.issues || [],
        recommendations: parsed.recommendations || [],
        provider: result.provider,
        model: result.model
    };
}

/**
 * Save daily summary to Supabase
 */
export async function saveDailySummary(summary: DailySummary): Promise<DailySummary> {
    const { data, error } = await supabase
        .from('day_ai_summaries')
        .upsert({
            log_date: summary.log_date,
            total_volume: summary.totalVolume,
            transaction_count: summary.transactionCount,
            buy_volume: summary.buyVolume,
            sell_volume: summary.sellVolume,
            shift_stats: summary.shiftStats,
            summary_text: summary.summary,
            insights: {
                managementInsights: summary.managementInsights,
                issues: summary.issues,
                recommendations: summary.recommendations,
                bestShift: summary.bestShift
            },
            provider: summary.provider,
            model: summary.model
        }, {
            onConflict: 'log_date'
        })
        .select()
        .single();

    if (error) {
        console.error('Failed to save daily summary:', error);
        throw new Error(`Failed to save daily summary: ${error.message}`);
    }

    return {
        ...summary,
        id: data.id,
        created_at: data.created_at
    };
}

/**
 * Get existing daily summary for a date
 */
export async function getDailySummary(logDate: string): Promise<DailySummary | null> {
    const { data, error } = await supabase
        .from('day_ai_summaries')
        .select('*')
        .eq('log_date', logDate)
        .single();

    if (error || !data) {
        return null;
    }

    return {
        id: data.id,
        log_date: data.log_date,
        totalVolume: data.total_volume,
        transactionCount: data.transaction_count,
        buyVolume: data.buy_volume,
        sellVolume: data.sell_volume,
        shiftStats: data.shift_stats,
        summary: data.summary_text,
        managementInsights: data.insights?.managementInsights || [],
        issues: data.insights?.issues || [],
        recommendations: data.insights?.recommendations || [],
        bestShift: data.insights?.bestShift || null,
        provider: data.provider,
        model: data.model,
        created_at: data.created_at
    };
}

