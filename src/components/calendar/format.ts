/** Locale-aware formatting for the island. Dates are formatted as UTC noon of the local day. */
import { formatMinutes, toFormatDate, type LocalDate } from "@/lib/time/local-date";
import type { Lang } from "@/lib/timetable/types";

const locale = (lang: Lang) => (lang === "pl" ? "pl-PL" : "en-GB");
const cache = new Map<string, Intl.DateTimeFormat>();

function fmt(lang: Lang, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    const key = lang + JSON.stringify(opts);
    let f = cache.get(key);
    if (!f) {
        f = new Intl.DateTimeFormat(locale(lang), { ...opts, timeZone: "UTC" });
        cache.set(key, f);
    }
    return f;
}

export const weekdayLong = (lang: Lang, d: LocalDate) =>
    fmt(lang, { weekday: "long" }).format(toFormatDate(d));
export const weekdayShort = (lang: Lang, d: LocalDate) =>
    fmt(lang, { weekday: "short" }).format(toFormatDate(d)).replace(/\.$/, "");
export const dayMonth = (lang: Lang, d: LocalDate) =>
    fmt(lang, { day: "numeric", month: "long" }).format(toFormatDate(d));
export const dayMonthShort = (lang: Lang, d: LocalDate) =>
    fmt(lang, { day: "numeric", month: "short" }).format(toFormatDate(d)).replace(/\.$/, "");
export const fullDate = (lang: Lang, d: LocalDate) =>
    fmt(lang, { weekday: "long", day: "numeric", month: "long" }).format(toFormatDate(d));

export function rangeLabel(lang: Lang, from: LocalDate, to: LocalDate): string {
    if (from === to) return fullDate(lang, from);
    const f = fmt(lang, { day: "numeric", month: "long" });
    return f.formatRange(toFormatDate(from), toFormatDate(to));
}

/** The week heading, also used as the page title: "10–11 października", "10 – 11 October". */
export const weekHeading = (lang: Lang, [from, to]: [LocalDate, LocalDate]) =>
    capitalize(rangeLabel(lang, from, to));

export const timeRange = (start: number, end: number) =>
    `${formatMinutes(start)}–${formatMinutes(end)}`;
export { formatMinutes };

export function duration(lang: Lang, minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const hs = lang === "pl" ? "godz." : "h";
    if (h && m) return `${h} ${hs} ${m} min`;
    if (h) return `${h} ${hs}`;
    return `${m} min`;
}

const rtf = new Map<Lang, Intl.RelativeTimeFormat>();

/** "przed chwilą", "12 min temu", "3 godz. temu", "2 dni temu" — for an age in ms. */
export function ago(lang: Lang, justNow: string, ms: number): string {
    const min = Math.floor(ms / 60_000);
    if (min < 1) return justNow;
    let f = rtf.get(lang);
    if (!f) {
        f = new Intl.RelativeTimeFormat(locale(lang), { style: "short" });
        rtf.set(lang, f);
    }
    if (min < 60) return f.format(-min, "minute");
    if (min < 24 * 60) return f.format(-Math.floor(min / 60), "hour");
    return f.format(-Math.floor(min / (24 * 60)), "day");
}

/** "3 paź 2026, 14:05" in the university's timezone, for an instant. */
export const instant = (lang: Lang, iso: string, timeZone: string) =>
    new Intl.DateTimeFormat(locale(lang), {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone,
    }).format(new Date(iso));

export function capitalize(s: string): string {
    return s.charAt(0).toLocaleUpperCase() + s.slice(1);
}
