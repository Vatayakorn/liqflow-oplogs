/**
 * Diff Utilities for Edit Change Log
 * Computes and formats changes between old and new session data
 */

export interface ChangeEntry {
    field: string;
    oldValue: any;
    newValue: any;
}

export interface EditHistoryEntry {
    timestamp: string;
    changes: ChangeEntry[];
}

// Fields to track for changes (human-readable labels)
const FIELD_LABELS: Record<string, string> = {
    start_time: 'Start Time',
    end_time: 'End Time',
    broker: 'Broker',
    trader: 'Trader',
    head: 'Head',
    recorder: 'Recorder',
    fx_rate: 'FX Rate',
    fx_notes: 'FX Notes',
    btz_bid: 'BTZ Bid',
    btz_ask: 'BTZ Ask',
    btz_notes: 'BTZ Notes',
    exchange1: 'Exchange 1',
    exchange1_price: 'Exchange 1 Price',
    exchange2: 'Exchange 2',
    exchange2_price: 'Exchange 2 Price',
    exchange_diff: 'Exchange Diff',
    exchange_higher: 'Higher Exchange',
    exchange_notes: 'Exchange Notes',
    prefund_current: 'Prefund Current',
    prefund_target: 'Prefund Target',
    prefund_notes: 'Prefund Status Notes',
    matching_notes: 'Matching Notes',
    otc_notes: 'OTC Notes',
    note: 'Notes',
    shift: 'Shift',
};

// Fields to ignore when computing diff
const IGNORE_FIELDS = ['id', 'day_id', 'created_at', 'images', 'audio', 'edit_history', 'market_context', 'otc_transactions'];

/**
 * Check if two values are meaningfully different
 */
function isDifferent(oldVal: any, newVal: any): boolean {
    // Treat null, undefined, and empty string as equivalent
    const normalizeEmpty = (v: any) => (v === null || v === undefined || v === '') ? null : v;
    const normOld = normalizeEmpty(oldVal);
    const normNew = normalizeEmpty(newVal);

    if (normOld === normNew) return false;

    // Numeric comparison (handle string vs number)
    if (typeof normOld === 'number' || typeof normNew === 'number') {
        return Number(normOld) !== Number(normNew);
    }

    return normOld !== normNew;
}

/**
 * Compute changes between old and new session data
 */
export function computeChanges(oldData: Record<string, any>, newData: Record<string, any>): ChangeEntry[] {
    const changes: ChangeEntry[] = [];

    for (const field of Object.keys(FIELD_LABELS)) {
        if (IGNORE_FIELDS.includes(field)) continue;

        const oldValue = oldData[field];
        const newValue = newData[field];

        if (isDifferent(oldValue, newValue)) {
            changes.push({
                field,
                oldValue: oldValue ?? null,
                newValue: newValue ?? null,
            });
        }
    }

    return changes;
}

/**
 * Format a change entry for display
 */
export function formatChangeForDisplay(change: ChangeEntry): string {
    const label = FIELD_LABELS[change.field] || change.field;
    const oldStr = change.oldValue ?? '(empty)';
    const newStr = change.newValue ?? '(empty)';
    return `${label}: ${oldStr} → ${newStr}`;
}

/**
 * Format multiple changes for toast notification
 */
export function formatChangesForToast(changes: ChangeEntry[], maxItems = 3): string {
    if (changes.length === 0) return 'No changes detected';

    const displayChanges = changes.slice(0, maxItems);
    const lines = displayChanges.map(formatChangeForDisplay);

    if (changes.length > maxItems) {
        lines.push(`...and ${changes.length - maxItems} more`);
    }

    return lines.join('\n');
}

/**
 * Format changes for short summary (field names only)
 */
export function formatChangesSummary(changes: ChangeEntry[]): string {
    if (changes.length === 0) return 'No changes';

    const labels = changes.map(c => FIELD_LABELS[c.field] || c.field);
    return `Changed: ${labels.join(', ')}`;
}
