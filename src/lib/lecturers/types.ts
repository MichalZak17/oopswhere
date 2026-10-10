/**
 * Lecturer shapes shared by the server, the search box and the lecturer page. Keep this
 * file free of server-only imports: it ships to the browser.
 */
import type { LangText } from "@/lib/timetable/types";

/** A teaching staff member, as public USOS data. */
export interface Lecturer {
    /** USOS user id (staff ids are public). */
    id: string;
    first: string;
    last: string;
    /** Academic titles before and after the name: "dr hab. inż." … "prof. ZUT". */
    before: string;
    after: string;
    /** Department (USOS employment faculty), if any. */
    unit: LangText | null;
}

/** GET /api/v1/lecturers?q= */
export interface LecturerSearchResult {
    items: Lecturer[];
}

/** "Łukasz Cierocki" */
export function plainName(l: Pick<Lecturer, "first" | "last">): string {
    return [l.first, l.last].filter(Boolean).join(" ");
}

/** "dr hab. Inga Kowalewska, prof. ZUT" */
export function fullName(l: Pick<Lecturer, "first" | "last" | "before" | "after">): string {
    const name = [l.before, plainName(l)].filter(Boolean).join(" ");
    return l.after ? `${name}, ${l.after}` : name;
}

/** Search queries shorter than this aren't sent to USOS. */
export const MIN_QUERY = 2;
