/**
 * Time Presets Configuration
 * Provides fixed time presets and generates every-30-minute presets
 */

export interface Preset {
    h: number;
    m: number;
    key: string;
}

/**
 * Fixed presets from user requirements
 * These are specific times used by the operations team
 */
export const fixedPresets: Preset[] = [
    { h: 17, m: 0, key: '17_00' },
    { h: 22, m: 50, key: '22_50' },
    { h: 22, m: 55, key: '22_55' },
    { h: 22, m: 59, key: '22_59' }
];

/**
 * Generate presets for every 30 minutes throughout the day
 * Returns: 00:00, 00:30, 01:00, 01:30, ... 23:00, 23:30 (48 presets)
 */
export function generateEvery30mPresets(): Preset[] {
    const presets: Preset[] = [];

    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 30) {
            const key = `${h.toString().padStart(2, '0')}_${m.toString().padStart(2, '0')}`;
            presets.push({ h, m, key });
        }
    }

    return presets;
}

/**
 * Format hours and minutes as HH:MM string
 */
export function formatTime(h: number, m: number): string {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Format preset key as display time (e.g., "17_00" -> "17:00")
 */
export function formatPresetKey(key: string): string {
    return key.replace('_', ':');
}

/**
 * Parse time string (HH:MM) to hours and minutes
 */
export function parseTime(time: string): { h: number; m: number } | null {
    const match = time.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    return {
        h: parseInt(match[1], 10),
        m: parseInt(match[2], 10)
    };
}

/**
 * Add minutes to a time and return new time string
 */
export function addMinutes(time: string, minutes: number): string {
    const parsed = parseTime(time);
    if (!parsed) return time;

    const totalMinutes = parsed.h * 60 + parsed.m + minutes;
    const newH = Math.floor(totalMinutes / 60) % 24;
    const newM = totalMinutes % 60;

    return formatTime(newH, newM);
}

/**
 * Preset mode types
 */
export type PresetMode = 'fixed' | 'every30m';
