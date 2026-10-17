/** Raw USOS staff data → the compact shapes in ./types. */
import { langText } from "@/lib/timetable/normalize";
import { relevantTerms } from "@/lib/terms";
import type { LocalDate } from "@/lib/time/local-date";
import type { GroupKey, TimetablePayload } from "@/lib/timetable/types";
import type { RawGroup, RawTerm, RawUser } from "@/lib/usos/api";
import type { Lecturer } from "./types";

/** USOS user ids are positive integers; anything else never reaches USOS. */
export function isStaffId(value: unknown): value is string {
    return typeof value === "string" && /^[1-9]\d{0,9}$/.test(value);
}

/** One cache entry per query however it was typed: "  Łukasz  CIER " → "łukasz cier". */
export function normalizeQuery(value: unknown): string {
    if (typeof value !== "string") return "";
    return value.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase("pl").slice(0, 60);
}

export function normalizeLecturer(raw: RawUser): Lecturer {
    const unit = raw.employment_positions?.find((p) => p.faculty?.name?.pl?.trim())?.faculty;
    return {
        id: String(raw.id),
        first: raw.first_name?.trim() ?? "",
        last: raw.last_name?.trim() ?? "",
        before: raw.titles?.before?.trim() ?? "",
        after: raw.titles?.after?.trim() ?? "",
        unit: unit ? langText(unit.name) : null,
    };
}

/** What we cache per lecturer: who they are and every group they teach in the active terms. */
export interface LecturerData {
    lecturer: Lecturer;
    terms: Pick<RawTerm, "id" | "start_date" | "end_date" | "finish_date">[];
    /** [termId, unitId, groupNumber] */
    groups: [string, number, number][];
}

export function normalizeLecturerData(
    user: RawUser,
    taught: { groups?: Record<string, RawGroup[]>; terms?: RawTerm[] },
): LecturerData {
    const groups: LecturerData["groups"] = [];
    const seen = new Set<string>();
    for (const [termId, list] of Object.entries(taught.groups ?? {})) {
        for (const g of list) {
            const unit = Number(g.course_unit_id);
            const num = Number(g.group_number);
            const key = `${unit}-${num}`;
            if (!Number.isInteger(unit) || !Number.isInteger(num) || seen.has(key)) continue;
            seen.add(key);
            groups.push([g.term_id ?? termId, unit, num]);
        }
    }
    return {
        lecturer: normalizeLecturer(user),
        terms: (taught.terms ?? []).map(({ id, start_date, end_date, finish_date }) => ({
            id,
            start_date,
            end_date,
            finish_date,
        })),
        groups,
    };
}

/**
 * The groups to show today: those of terms that are running or about to start, the same
 * rule a student's own plan uses. If USOS sent no term dates, everything it sent.
 */
export function currentGroups(data: LecturerData, today: LocalDate, max = 150): [number, number][] {
    const terms = new Set(relevantTerms(data.terms, today).map((t) => t.id));
    return data.groups
        .filter(([term]) => data.terms.length === 0 || terms.has(term))
        .slice(0, max)
        .map(([, unit, num]) => [unit, num]);
}

/**
 * A lecturer's own meetings. `groups/lecturer` lists every group someone is attached to, but a
 * lab group's meetings are often split between several people (each meeting has its own
 * `lecturer_ids`), so the whole group's schedule would show them in two buildings at once.
 * Meetings with no lecturer listed stay: USOS just doesn't say who runs them. Groups that
 * have meetings, none of them theirs, are dropped.
 */
export function onlyTheirMeetings(payload: TimetablePayload, lecturerId: string): TimetablePayload {
    const id = Number(lecturerId);
    const meetings = payload.meetings.filter((m) => m[6].length === 0 || m[6].includes(id));
    const scheduled = new Set(payload.meetings.map((m) => m[0]));
    const theirs = new Set(meetings.map((m) => m[0]));
    const groups = Object.fromEntries(
        Object.entries(payload.groups).filter(
            ([key]) => theirs.has(key as GroupKey) || !scheduled.has(key as GroupKey),
        ),
    ) as TimetablePayload["groups"];
    const people = new Set(meetings.flatMap((m) => m[6]).map(String));
    return {
        ...payload,
        groups,
        meetings,
        people: Object.fromEntries(Object.entries(payload.people).filter(([p]) => people.has(p))),
    };
}
