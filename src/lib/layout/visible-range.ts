/** Which weekdays to show and which hours to draw, fitted to the student's real term. */

export interface TimeSpan {
    start: number;
    end: number;
}

/** Weekdays (0 = Mon … 6 = Sun) that have at least one class anywhere in the term. */
export function activeWeekdays(weekdays: Iterable<number>): number[] {
    const set = new Set<number>();
    for (const d of weekdays) set.add(d);
    const days = [...set].sort((a, b) => a - b);
    return days.length > 0 ? days : [0, 1, 2, 3, 4];
}

/**
 * Hour range in minutes: floor of the earliest start to ceil of the latest end,
 * padded to at least `minHours` so a short day still looks like a day.
 */
export function hourRange(spans: Iterable<TimeSpan>, minHours = 6): TimeSpan {
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of spans) {
        lo = Math.min(lo, s.start);
        hi = Math.max(hi, s.end);
    }
    if (!Number.isFinite(lo)) return { start: 8 * 60, end: 16 * 60 };
    let start = Math.floor(lo / 60) * 60;
    let end = Math.ceil(hi / 60) * 60;
    while (end - start < minHours * 60) {
        if (end < 22 * 60) end += 60;
        else start -= 60;
    }
    return { start: Math.max(0, start), end: Math.min(24 * 60, end) };
}
