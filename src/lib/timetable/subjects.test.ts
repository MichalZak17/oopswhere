import { describe, expect, it } from "vitest";
import { buildSubjects } from "./subjects";
import type { GroupInfo, GroupKey, MeetingTuple, TimetablePayload } from "./types";

const info = (course: string, type: string, group: number): GroupInfo => ({
    courseId: `${course}-${type}`,
    course: { pl: course },
    type,
    typeName: { pl: type },
    group,
    url: null,
});

const meeting = (key: GroupKey, date: string, lecturers: number[]): MeetingTuple => [
    key,
    date,
    480,
    570,
    null,
    null,
    lecturers,
    null,
];

const payload = (over: Partial<TimetablePayload>): TimetablePayload => ({
    v: 1,
    inst: "zut",
    timeZone: "Europe/Warsaw",
    generatedAt: "2026-10-17T00:00:00Z",
    updatedAt: null,
    today: "2026-10-17",
    nowMin: 0,
    groups: {},
    people: {},
    buildings: {},
    meetings: [],
    missing: [],
    stale: [],
    gone: [],
    ...over,
});

describe("buildSubjects", () => {
    it("lists one row per group, alphabetical by course, lecture before laboratory", () => {
        const rows = buildSubjects(
            payload({
                groups: {
                    "2-1": info("Język angielski 2", "LK", 1),
                    "1-5": info("Elementy robotyki", "LB", 5),
                    "1-1": info("Elementy robotyki", "WK", 1),
                    "3-1": info("Źródła", "WK", 1),
                    "4-1": info("Zarządzanie", "WK", 1),
                },
            }),
            "pl",
        );
        expect(rows.map((r) => `${r.course}/${r.type}`)).toEqual([
            "Elementy robotyki/WK",
            "Elementy robotyki/LB",
            "Język angielski 2/LK",
            "Zarządzanie/WK",
            "Źródła/WK", // Polish collation: Ź after Z
        ]);
    });

    it("orders lecturers by how many meetings they teach and skips unknown ids", () => {
        const rows = buildSubjects(
            payload({
                groups: { "1-1": info("Bazy danych", "WK", 1) },
                people: { "10": ["Jarosław", "Woźniak", "dr"], "20": ["Anna", "Nowak", "mgr"] },
                meetings: [
                    meeting("1-1", "2026-10-10", [20]),
                    meeting("1-1", "2026-10-17", [10, 20]),
                    meeting("1-1", "2026-10-24", [10, 99]),
                    meeting("1-1", "2026-10-31", [10]),
                ],
            }),
            "pl",
        );
        expect(rows[0]!.lecturers).toEqual([
            { id: "10", name: "dr Jarosław Woźniak" },
            { id: "20", name: "mgr Anna Nowak" },
        ]);
    });

    it("keeps titles before the name and drops a trailing 'prof. ZUT'", () => {
        const rows = buildSubjects(
            payload({
                groups: { "1-1": info("Fizyka", "WK", 1) },
                people: {
                    "1": ["Inga", "Kowalewska", "dr hab. prof. ZUT"],
                    "2": ["Jan", "Prus", "prof. dr hab."],
                },
                meetings: [meeting("1-1", "2026-10-10", [1, 2])],
            }),
            "pl",
        );
        expect(rows[0]!.lecturers.map((l) => l.name)).toEqual([
            "dr hab. Inga Kowalewska",
            "prof. dr hab. Jan Prus",
        ]);
    });

    it("falls back to the course id when the name is empty, and has no lecturers without meetings", () => {
        const rows = buildSubjects(
            payload({ groups: { "1-1": { ...info("", "WK", 1), courseId: "XYZ-WK" } } }),
            "en",
        );
        expect(rows).toEqual([
            { key: "1-1", course: "XYZ-WK", type: "WK", typeName: "WK", group: 1, lecturers: [] },
        ]);
    });
});
