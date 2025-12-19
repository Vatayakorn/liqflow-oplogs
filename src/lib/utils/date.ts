/**
 * Date and Time utilities
 */

/**
 * Combine a date string (YYYY-MM-DD) and time string (HH:mm or HH:mm:ss) into a Date object
 * @param dateStr YYYY-MM-DD
 * @param timeStr HH:mm or HH:mm:ss
 * @returns Date object
 */
export function combineDateTime(dateStr: string, timeStr: string): Date {
    // Ensure timeStr has seconds
    const time = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
    return new Date(`${dateStr}T${time}`);
}

/**
 * Add hours to a Date object
 * @param date Date object
 * @param hours Number of hours to add (can be negative)
 * @returns New Date object
 */
export function addHours(date: Date, hours: number): Date {
    const newDate = new Date(date);
    newDate.setHours(newDate.getHours() + hours);
    return newDate;
}
