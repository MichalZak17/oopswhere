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

export function capitalize(s: string): string {
    return s.charAt(0).toLocaleUpperCase() + s.slice(1);
}
