/**
 * Shapes shared by the server and the calendar island. Keep this file free of
 * server-only imports — it ships to the browser.
 */
import type { LocalDate } from "../time/local-date";

export type { LocalDate };
export type Lang = "pl" | "en";

/** USOS LangDict, with empty English values dropped. */
export interface LangText {
    pl: string;
    en?: string;
}

/** `${unitId}-${groupNumber}` — a USOS class group. */
export type GroupKey = `${number}-${number}`;

export interface GroupInfo {
    courseId: string;
    course: LangText;
    /** Class type code: WK, LB, CW, PR, LK, … */
    type: string;
    typeName: LangText;
    group: number;
    url: string | null;
}

export interface BuildingInfo {
    /** Short label for cards, e.g. "WI1". */
    label: string;
    name: LangText;
}

/**
 * One meeting, as a compact tuple:
 * [group, date, startMin, endMin, room, buildingId, lecturerIds, meetingId]
 */
export type MeetingTuple = [
    group: GroupKey,
    date: LocalDate,
    start: number,
    end: number,
    room: string | null,
    building: string | null,
    lecturers: number[],
    id: number | null,
];

export interface TimetablePayload {
    v: 1;
    inst: string;
    timeZone: string;
    generatedAt: string;
    /** Server wall clock — the first render uses it so hydration matches. */
    today: LocalDate;
    nowMin: number;
    groups: Record<GroupKey, GroupInfo>;
    /** Lecturer id → [first name, last name, academic title]. */
    people: Record<string, [string, string, string]>;
    buildings: Record<string, BuildingInfo>;
    meetings: MeetingTuple[];
    /** Groups not loaded within the time budget — fetch /api/v1/timetable to fill in. */
    missing: GroupKey[];
    /** Groups served from an old cache entry because USOS was unreachable. */
    stale: GroupKey[];
    /** Groups USOS no longer knows — the student should refresh their groups. */
    gone: GroupKey[];
}
