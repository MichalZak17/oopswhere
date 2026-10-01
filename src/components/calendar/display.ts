/** Small display helpers shared by the calendar components. */
import { pick } from "@/i18n/pick";
import type { Dict } from "@/i18n";
import type { BuildingInfo, GroupInfo, Lang } from "@/lib/timetable/types";
import type { ClassEvent } from "./model";
import { duration, formatMinutes, dayMonthShort, weekdayShort } from "./format";
import { addDays, type LocalDate } from "@/lib/time/local-date";

export type Types = Dict["types"];
export type CalDict = Dict["cal"];

export function typeName(types: Types, info: GroupInfo | undefined, lang: Lang): string {
    if (!info) return "";
    return types[info.type] ?? (pick(info.typeName, lang) || info.type);
}

/** USOS's own class-type code (WK, LB, CW…) — what students already see in USOSweb. */
export function typeCode(info: GroupInfo | undefined): string {
    return info?.type ?? "";
}

export function courseName(info: GroupInfo | undefined, lang: Lang): string {
    return info ? pick(info.course, lang) || info.courseId : "";
}

/** "WI1 303" — building label first, the way students say it. */
export function placeLabel(ev: ClassEvent, buildings: Record<string, BuildingInfo>): string {
    const b = ev.buildingId ? (buildings[ev.buildingId]?.label ?? ev.buildingId) : "";
    return [b, ev.room].filter(Boolean).join(" ") || "—";
}

/** "za 23 min", "jutro, 8:00", "sob 10 paź, 8:00" */
export function relativeStart(
    lang: Lang,
    dict: CalDict,
    ev: ClassEvent,
    today: LocalDate,
    nowMin: number,
): string {
    if (ev.date === today) return `${dict.in} ${duration(lang, Math.max(1, ev.start - nowMin))}`;
    if (ev.date === addDays(today, 1)) return `${dict.tomorrow}, ${formatMinutes(ev.start)}`;
    return `${weekdayShort(lang, ev.date)} ${dayMonthShort(lang, ev.date)}, ${formatMinutes(ev.start)}`;
}
