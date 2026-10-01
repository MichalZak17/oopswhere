/** Pure view-model helpers for the calendar island (no DOM, unit-tested). */
import { layoutDay, type Placement } from "@/lib/layout/lanes";
import { activeWeekdays } from "@/lib/layout/visible-range";
import { addDays, startOfWeek, weekday, type LocalDate } from "@/lib/time/local-date";
import type { GroupKey, TimetablePayload } from "@/lib/timetable/types";

export interface ClassEvent {
    id: string;
    key: GroupKey;
    date: LocalDate;
    start: number;
    end: number;
    room: string | null;
    buildingId: string | null;
    lecturerIds: number[];
}

export interface PlacedEvent {
    ev: ClassEvent;
    place: Placement;
}

export function expand(payload: TimetablePayload): ClassEvent[] {
    return payload.meetings.map(([key, date, start, end, room, buildingId, lecturerIds]) => ({
        id: `${key}_${date}_${start}`,
        key,
        date,
        start,
        end,
        room,
        buildingId,
        lecturerIds,
    }));
}

export function indexByDate(events: readonly ClassEvent[]): Map<LocalDate, ClassEvent[]> {
    const map = new Map<LocalDate, ClassEvent[]>();
    for (const ev of events) {
        const list = map.get(ev.date);
        if (list) list.push(ev);
        else map.set(ev.date, [ev]);
    }
    return map;
}

export function placeDay(events: readonly ClassEvent[]): PlacedEvent[] {
    const places = layoutDay(events.map((e) => ({ id: e.id, start: e.start, end: e.end })));
    return events.map((ev) => ({ ev, place: places.get(ev.id)! }));
}

export function weekDates(anchor: LocalDate): LocalDate[] {
    return Array.from({ length: 7 }, (_, i) => addDays(anchor, i));
}

/** Distinct Mondays of weeks that have classes, ascending. */
export function classWeeks(events: readonly ClassEvent[]): LocalDate[] {
    return [...new Set(events.map((e) => startOfWeek(e.date)))].sort();
}

/** Weekend (zaoczne) programmes only ever meet Fri–Sun; we label their weeks as sessions. */
export function isWeekendProgramme(activeDays: readonly number[]): boolean {
    return activeDays.length > 0 && activeDays.every((d) => d >= 4);
}

export function currentAndNext(
    events: readonly ClassEvent[],
    today: LocalDate,
    nowMin: number,
): { current: ClassEvent[]; next: ClassEvent | null } {
    const current: ClassEvent[] = [];
    let next: ClassEvent | null = null;
    for (const ev of events) {
        if (ev.date < today) continue;
        if (ev.date === today && ev.end <= nowMin) continue;
        if (ev.date === today && ev.start <= nowMin) {
            current.push(ev);
            continue;
        }
        if (!next || ev.date < next.date || (ev.date === next.date && ev.start < next.start))
            next = ev;
    }
    return { current, next };
}

/** First event on or after `date`. Events must be sorted. */
export function firstOnOrAfter(events: readonly ClassEvent[], date: LocalDate): ClassEvent | null {
    return events.find((e) => e.date >= date) ?? null;
}

/** Last event before `date`. Events must be sorted. */
export function lastBefore(events: readonly ClassEvent[], date: LocalDate): ClassEvent | null {
    for (let i = events.length - 1; i >= 0; i--) if (events[i].date < date) return events[i];
    return null;
}

export function visibleDays(
    dates: readonly LocalDate[],
    activeDays: readonly number[],
    byDate: Map<LocalDate, ClassEvent[]>,
    showAll: boolean,
): LocalDate[] {
    if (showAll) return [...dates];
    return dates.filter((d) => activeDays.includes(weekday(d)) || (byDate.get(d)?.length ?? 0) > 0);
}

/** First and last day the week heading names: the visible days, or the whole week when it has no classes. */
export function headingSpan(
    dates: readonly LocalDate[],
    days: readonly LocalDate[],
    weekCount: number,
    showAll: boolean,
): [LocalDate, LocalDate] {
    return weekCount > 0 || showAll
        ? [days[0] ?? dates[0], days.at(-1) ?? dates[6]]
        : [dates[0], dates[6]];
}

/** The heading span as the island first renders the week (all-days preference not read yet). */
export function initialHeadingSpan(
    payload: TimetablePayload,
    anchor: LocalDate,
): [LocalDate, LocalDate] {
    const events = expand(payload);
    const byDate = indexByDate(events);
    const dates = weekDates(anchor);
    const days = visibleDays(
        dates,
        activeWeekdays(events.map((e) => weekday(e.date))),
        byDate,
        false,
    );
    const weekCount = days.reduce((n, d) => n + (byDate.get(d)?.length ?? 0), 0);
    return headingSpan(dates, days, weekCount, false);
}
