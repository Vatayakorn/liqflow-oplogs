/**
 * Export API - Functions for exporting operation logs
 * Optimized for AI analysis
 */

import { supabase } from '$lib/supabaseClient';
import type { OplogSession } from './oplog';

export interface ExportDateRange {
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
}

export interface ExportStats {
    totalDays: number;
    totalSessions: number;
    totalOtcTransactions: number;
    sessionsByShift: { A: number; B: number; C: number };
    avgFxRate: number | null;
}

export interface DayWithSessions {
    date: string;
    dayOfWeek: string;
    sessions: OplogSession[];
}

/**
 * Fetch all sessions within a date range
 */
export async function getSessionsByDateRange(
    startDate: string,
    endDate: string
): Promise<DayWithSessions[]> {
    // Get all days in range
    const { data: days, error: daysError } = await supabase
        .from('oplog_days')
        .select('id, log_date')
        .gte('log_date', startDate)
        .lte('log_date', endDate)
        .order('log_date', { ascending: true });

    if (daysError || !days || days.length === 0) {
        return [];
    }

    const dayIds = days.map(d => d.id);

    // Get all sessions for these days
    const { data: sessions, error: sessionsError } = await supabase
        .from('oplog_sessions')
        .select('*')
        .in('day_id', dayIds)
        .order('start_time', { ascending: true });

    if (sessionsError) {
        throw new Error(`Failed to fetch sessions: ${sessionsError.message}`);
    }

    // Group sessions by day
    const result: DayWithSessions[] = [];
    for (const day of days) {
        const daySessions = (sessions || []).filter(s => s.day_id === day.id);
        const date = new Date(day.log_date);
        result.push({
            date: day.log_date,
            dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'long' }),
            sessions: daySessions
        });
    }

    return result;
}

/**
 * Calculate export statistics
 */
export function calculateExportStats(daysWithSessions: DayWithSessions[]): ExportStats {
    let totalSessions = 0;
    let totalOtc = 0;
    let fxRates: number[] = [];
    const shiftCounts = { A: 0, B: 0, C: 0 };

    for (const day of daysWithSessions) {
        totalSessions += day.sessions.length;

        for (const session of day.sessions) {
            // Count OTC transactions
            if (session.otc_transactions && Array.isArray(session.otc_transactions)) {
                totalOtc += session.otc_transactions.length;
            }

            // Collect FX rates
            if (session.fx_rate) {
                fxRates.push(session.fx_rate);
            }

            // Count by shift
            if (session.shift && shiftCounts.hasOwnProperty(session.shift)) {
                shiftCounts[session.shift as 'A' | 'B' | 'C']++;
            }
        }
    }

    return {
        totalDays: daysWithSessions.filter(d => d.sessions.length > 0).length,
        totalSessions,
        totalOtcTransactions: totalOtc,
        sessionsByShift: shiftCounts,
        avgFxRate: fxRates.length > 0
            ? parseFloat((fxRates.reduce((a, b) => a + b, 0) / fxRates.length).toFixed(2))
            : null
    };
}

/**
 * Format time for display
 */
function formatTime(time: string | null): string {
    if (!time) return '–';
    return time.slice(0, 5);
}

/**
 * Format number with locale
 */
function formatNumber(num: number | null | undefined, decimals: number = 2): string {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

/**
 * Generate the full export content as AI-optimized text
 */
export function generateExportContent(
    daysWithSessions: DayWithSessions[],
    dateRange: ExportDateRange
): string {
    const stats = calculateExportStats(daysWithSessions);
    const exportTime = new Date().toLocaleString('th-TH');

    let content = '';

    // ═══ HEADER ═══
    content += '═══════════════════════════════════════════════════════════════════════════════\n';
    content += '                    LIQFLOW OPERATION LOGS EXPORT\n';
    content += '═══════════════════════════════════════════════════════════════════════════════\n';
    content += `Export Date: ${exportTime}\n`;
    content += `Date Range: ${dateRange.startDate} to ${dateRange.endDate}\n`;
    content += `Total Days: ${stats.totalDays}\n`;
    content += `Total Sessions: ${stats.totalSessions}\n\n`;

    content += 'SUMMARY STATISTICS:\n';
    content += `  Total OTC Transactions: ${stats.totalOtcTransactions}\n`;
    content += `  Avg FX Rate: ${stats.avgFxRate ?? 'N/A'}\n`;
    content += `  Sessions by Shift: A=${stats.sessionsByShift.A}, B=${stats.sessionsByShift.B}, C=${stats.sessionsByShift.C}\n`;
    content += '\n═══════════════════════════════════════════════════════════════════════════════\n\n';

    // ═══ EACH DAY ═══
    for (const day of daysWithSessions) {
        if (day.sessions.length === 0) continue;

        content += `[DAY] ${day.date} (${day.dayOfWeek})\n`;
        content += `Sessions: ${day.sessions.length}\n\n`;

        // ─── EACH SESSION ───
        for (const session of day.sessions) {
            content += '--------------------------------------------------------------------------------\n';
            content += `[SESSION] Shift ${session.shift} | ${formatTime(session.start_time)} - ${formatTime(session.end_time)}\n`;
            content += `Team: Broker=${session.broker || '-'}, Trader=${session.trader || '-'}, Head=${session.head || '-'}`;
            if (session.recorder) content += `, Recorder=${session.recorder}`;
            content += '\n';
            content += '--------------------------------------------------------------------------------\n\n';

            // FX Section
            if (session.fx_rate || (session.fx_prices && session.fx_prices.length > 0)) {
                content += `FX_RATE: ${session.fx_rate ?? 'N/A'}\n`;
                if (session.fx_notes) content += `FX_NOTES: ${session.fx_notes}\n`;

                if (session.fx_prices && session.fx_prices.length > 0) {
                    content += 'FX_HISTORY:\n';
                    for (const entry of session.fx_prices) {
                        const time = new Date(entry.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                        content += `  ${time} | RATE=${entry.rate}`;
                        if (entry.note) content += ` | Note: ${entry.note}`;
                        content += '\n';
                    }
                }
                content += '\n';
            }

            // Broker Prices - Maxbit
            if (session.btz_bid || session.btz_ask || (session.maxbit_prices && session.maxbit_prices.length > 0)) {
                content += 'BROKER_MAXBIT:\n';
                if (session.btz_bid) content += `  USDT_BID: ${session.btz_bid}\n`;
                if (session.btz_ask) content += `  USDT_ASK: ${session.btz_ask}\n`;
                if (session.btz_usdc_bid) content += `  USDC_BID: ${session.btz_usdc_bid}\n`;
                if (session.btz_usdc_ask) content += `  USDC_ASK: ${session.btz_usdc_ask}\n`;
                if (session.btz_notes) content += `  NOTES: ${session.btz_notes}\n`;

                if (session.maxbit_prices && session.maxbit_prices.length > 0) {
                    content += 'MAXBIT_HISTORY:\n';
                    for (const entry of session.maxbit_prices) {
                        const time = new Date(entry.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                        content += `  ${time} | BID=${entry.bid} ASK=${entry.ask}`;
                        if (entry.note) content += ` | Note: ${entry.note}`;
                        content += '\n';
                    }
                }
                content += '\n';
            }

            // Broker Prices - Bitazza
            if (session.bitazza_prices && session.bitazza_prices.length > 0) {
                content += 'BROKER_BITAZZA:\n';
                for (const entry of session.bitazza_prices) {
                    const time = new Date(entry.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                    content += `  ${time} | BID=${entry.bid} ASK=${entry.ask}`;
                    if (entry.note) content += ` | Note: ${entry.note}`;
                    content += '\n';
                }
                content += '\n';
            }

            // Broker Prices - Zcom
            if (session.zcom_prices && session.zcom_prices.length > 0) {
                content += 'BROKER_ZCOM:\n';
                for (const entry of session.zcom_prices) {
                    const time = new Date(entry.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                    content += `  ${time} | BID=${entry.bid} ASK=${entry.ask}`;
                    if (entry.note) content += ` | Note: ${entry.note}`;
                    content += '\n';
                }
                content += '\n';
            }

            // Broker Prices - Xspring
            if (session.xspring_prices && session.xspring_prices.length > 0) {
                content += 'BROKER_XSPRING:\n';
                for (const entry of session.xspring_prices) {
                    const time = new Date(entry.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                    content += `  ${time} | BID=${entry.bid} ASK=${entry.ask}`;
                    if (entry.note) content += ` | Note: ${entry.note}`;
                    content += '\n';
                }
                content += '\n';
            }

            // Exchange Comparison
            if (session.exchange1 || session.exchange2 || (session.exchange_prices && session.exchange_prices.length > 0)) {
                content += 'EXCHANGE_COMPARISON:\n';
                if (session.exchange1) {
                    content += `  ${session.exchange1}: ${session.exchange1_price ?? '-'}\n`;
                }
                if (session.exchange2) {
                    content += `  ${session.exchange2}: ${session.exchange2_price ?? '-'}\n`;
                }
                if (session.exchange_diff) {
                    content += `  DIFF: ${session.exchange_diff} (${session.exchange_higher ?? '-'} higher)\n`;
                }
                if (session.exchange_notes) {
                    content += `  NOTES: ${session.exchange_notes}\n`;
                }

                if (session.exchange_prices && session.exchange_prices.length > 0) {
                    content += 'EXCHANGE_HISTORY:\n';
                    for (const entry of session.exchange_prices) {
                        const time = new Date(entry.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                        content += `  ${time} | ${entry.exchange1}(${entry.exchange1Bid}/${entry.exchange1Ask}) vs ${entry.exchange2}(${entry.exchange2Bid}/${entry.exchange2Ask})`;
                        if (entry.diff) content += ` | Diff=${entry.diff}`;
                        if (entry.note) content += ` | Note: ${entry.note}`;
                        content += '\n';
                    }
                }
                content += '\n';
            }

            // OTC Transactions
            if (session.otc_transactions && session.otc_transactions.length > 0) {
                content += 'OTC_TRANSACTIONS:\n';
                content += '  | Customer              | Action | Amount           | Total THB        | Status   |\n';
                content += '  |----------------------|--------|------------------|------------------|----------|\n';
                for (const tx of session.otc_transactions) {
                    const customer = (tx.customerName || '-').substring(0, 20).padEnd(20);
                    const action = (tx.action || '-').padEnd(6);
                    const amount = `${formatNumber(tx.amount, 0)} ${tx.currency || 'USDT'}`.padEnd(16);
                    const total = `฿${formatNumber(tx.total, 0)}`.padEnd(16);
                    const status = (tx.status || '-').padEnd(8);
                    content += `  | ${customer} | ${action} | ${amount} | ${total} | ${status} |\n`;
                }
                content += '\n';
            }

            // Prefund Status
            if (session.prefund_current !== null || session.prefund_target !== null) {
                content += 'PREFUND:\n';
                const current = session.prefund_current ?? 0;
                const target = session.prefund_target ?? 760000;
                const pct = target > 0 ? ((current / target) * 100).toFixed(1) : '0.0';
                content += `  CURRENT: ${formatNumber(current, 0)}\n`;
                content += `  TARGET: ${formatNumber(target, 0)}\n`;
                content += `  PERCENTAGE: ${pct}%\n`;
                if (session.prefund_notes) content += `  NOTES: ${session.prefund_notes}\n`;
                content += '\n';
            }

            // Status flags
            if (session.market_mode || session.inventory_status || session.risk_flag || session.execution_issue) {
                content += 'STATUS:\n';
                if (session.market_mode) content += `  MARKET_MODE: ${session.market_mode}\n`;
                if (session.inventory_status) content += `  INVENTORY: ${session.inventory_status}\n`;
                if (session.risk_flag) content += `  RISK_FLAG: ${session.risk_flag}\n`;
                if (session.execution_issue) content += `  EXECUTION_ISSUE: ${session.execution_issue}\n`;
                content += '\n';
            }

            // Performance
            if (session.pnl_snapshot !== null || session.action_taken) {
                content += 'PERFORMANCE:\n';
                if (session.pnl_snapshot !== null) {
                    const pnlStr = session.pnl_snapshot >= 0 ? `+${formatNumber(session.pnl_snapshot, 0)}` : formatNumber(session.pnl_snapshot, 0);
                    content += `  PNL_SNAPSHOT: ${pnlStr}\n`;
                }
                if (session.action_taken) content += `  ACTION_TAKEN: ${session.action_taken}\n`;
                content += '\n';
            }

            // Notes
            if (session.matching_notes || session.otc_notes || session.note) {
                content += 'NOTES:\n';
                if (session.matching_notes) content += `  MATCHING: ${session.matching_notes}\n`;
                if (session.otc_notes) content += `  OTC: ${session.otc_notes}\n`;
                if (session.note) content += `  GENERAL: ${session.note}\n`;
                content += '\n';
            }

            content += '[END_SESSION]\n\n';
        }

        content += '[END_DAY]\n\n';
        content += '═══════════════════════════════════════════════════════════════════════════════\n\n';
    }

    content += '[END_EXPORT]\n';

    return content;
}

/**
 * Download content as a text file
 */
export function downloadAsTextFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
