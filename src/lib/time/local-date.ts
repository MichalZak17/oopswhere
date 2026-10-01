/**
 * Wall-clock date helpers. USOS returns naive local times ("2026-10-10 08:00:00",
 * Europe/Warsaw), and a timetable is laid out by wall clock, so we never convert to
 * UTC instants. Dates are 'YYYY-MM-DD' strings; arithmetic goes through Date.UTC whole
 * days, which makes it immune to DST transitions and to the device's own timezone.
 */

export type LocalDate = string;

const DAY_MS = 86_400_000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLocalDate(value: unknown): value is LocalDate {
    return typeof value === "string" && DATE_RE.test(value);
}

function toUtcMs(date: LocalDate): number {
    const m = DATE_RE.exec(date);
    if (!m) throw new RangeError(`Invalid local date: ${date}`);
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function fromUtcMs(ms: number): LocalDate {
    return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: LocalDate, days: number): LocalDate {
    return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

export function diffDays(from: LocalDate, to: LocalDate): number {
    return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

/** 0 = Monday … 6 = Sunday (ISO order, the way Polish calendars are printed). */
export function weekday(date: LocalDate): number {
    return (new Date(toUtcMs(date)).getUTCDay() + 6) % 7;
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: LocalDate): LocalDate {
    return addDays(date, -weekday(date));
}

/** ISO 8601 week number. */
export function isoWeek(date: LocalDate): number {
    const thursday = addDays(date, 3 - weekday(date));
    const yearStart = `${thursday.slice(0, 4)}-01-01`;
    return Math.floor(diffDays(yearStart, thursday) / 7) + 1;
}

export function parts(date: LocalDate): { year: number; month: number; day: number } {
    const m = DATE_RE.exec(date);
    if (!m) throw new RangeError(`Invalid local date: ${date}`);
    return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/** A Date at UTC noon of that day — safe to feed into Intl formatters with timeZone: "UTC". */
export function toFormatDate(date: LocalDate): Date {
    return new Date(toUtcMs(date) + DAY_MS / 2);
}

/** "2026-10-10 08:00:00" → { date: "2026-10-10", minutes: 480 } */
export function parseUsosDateTime(value: string): { date: LocalDate; minutes: number } | null {
    const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/.exec(value);
    if (!m) return null;
    return { date: m[1], minutes: Number(m[2]) * 60 + Number(m[3]) };
}

export function formatMinutes(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}:${m.toString().padStart(2, "0")}`;
}
