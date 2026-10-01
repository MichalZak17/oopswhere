import type { LocalDate } from "./local-date";

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
    let f = formatters.get(timeZone);
    if (!f) {
        f = new Intl.DateTimeFormat("en-CA", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
        });
        formatters.set(timeZone, f);
    }
    return f;
}

/**
 * The current wall-clock date and minute-of-day in the university's timezone,
 * regardless of the server's or the device's own timezone.
 */
export function zonedNow(
    timeZone: string,
    at: Date = new Date(),
): { today: LocalDate; nowMin: number } {
    const p: Record<string, string> = {};
    for (const { type, value } of formatter(timeZone).formatToParts(at)) p[type] = value;
    return {
        today: `${p.year}-${p.month}-${p.day}`,
        nowMin: Number(p.hour) * 60 + Number(p.minute),
    };
}
