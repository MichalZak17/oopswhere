import { describe, expect, it } from "vitest";
import type { TimetablePayload } from "@/lib/timetable/types";
import { weekHeading } from "./format";
import {
    classWeeks,
    currentAndNext,
    expand,
    firstOnOrAfter,
    indexByDate,
    initialHeadingSpan,
    isWeekendProgramme,
    landingWeek,
    visibleDays,
    weekDates,
} from "./model";

const payload = (): TimetablePayload => ({
    v: 1,
    inst: "zut",
    timeZone: "Europe/Warsaw",
    generatedAt: "",
    today: "2026-10-10",
    nowMin: 500,
    groups: {},
    people: {},
    buildings: {},
    meetings: [
        ["1-1", "2026-10-10", 480, 570, "303", "WI_WI1", [], 1],
        ["2-1", "2026-10-10", 580, 670, "100", "WI_WI2", [], 2],
        ["3-1", "2026-10-11", 480, 660, "10", "WI_WI2", [], 3],
        ["1-1", "2026-10-24", 480, 570, "303", "WI_WI1", [], 4],
    ],
    missing: [],
    stale: [],
    gone: [],
});

describe("calendar model", () => {
    const events = expand(payload());

    it("finds what's on now and what's next", () => {
        const { current, next } = currentAndNext(events, "2026-10-10", 500);
        expect(current.map((e) => e.key)).toEqual(["1-1"]);
        expect(next?.key).toBe("2-1");
        expect(currentAndNext(events, "2026-10-12", 0).next?.date).toBe("2026-10-24");
        expect(currentAndNext(events, "2026-11-01", 0)).toEqual({ current: [], next: null });
    });

    it("labels weekend programmes and lists class weeks", () => {
        expect(isWeekendProgramme([5, 6])).toBe(true);
        expect(isWeekendProgramme([0, 5])).toBe(false);
        expect(classWeeks(events)).toEqual(["2026-10-05", "2026-10-19"]);
    });

    it("shows active weekdays plus any day that has classes this week", () => {
        const byDate = indexByDate(events);
        const days = visibleDays(weekDates("2026-10-05"), [6], byDate, false);
        expect(days).toEqual(["2026-10-10", "2026-10-11"]);
        expect(visibleDays(weekDates("2026-10-05"), [5, 6], byDate, true)).toHaveLength(7);
    });

    it("jumps to the next week with classes", () => {
        expect(firstOnOrAfter(events, "2026-10-12")?.date).toBe("2026-10-24");
    });

    it("heads a week with its class days, or the whole week when it is empty", () => {
        expect(initialHeadingSpan(payload(), "2026-10-05")).toEqual(["2026-10-10", "2026-10-11"]);
        expect(initialHeadingSpan(payload(), "2026-09-28")).toEqual(["2026-09-28", "2026-10-04"]);
    });

    it("formats the heading for each language", () => {
        const span = initialHeadingSpan(payload(), "2026-10-05");
        expect(weekHeading("pl", span)).toMatch(/^10\s?–\s?11 października$/);
        expect(weekHeading("en", span)).toMatch(/^10\s?–\s?11 October$/);
        expect(weekHeading("en", ["2026-09-28", "2026-10-04"])).toMatch(
            /^28 September\s?–\s?4 October$/,
        );
    });
});

describe("landingWeek", () => {
    const events = expand(payload());

    it("stays on the current week while a class is running or still ahead", () => {
        expect(landingWeek(events, "2026-10-10", 500)).toBe("2026-10-05");
        expect(landingWeek(events, "2026-10-11", 100)).toBe("2026-10-05");
    });

    it("skips ahead to the next class week when this one is over or empty", () => {
        expect(landingWeek(events, "2026-10-11", 700)).toBe("2026-10-19");
        expect(landingWeek(events, "2026-10-14", 0)).toBe("2026-10-19");
    });

    it("falls back to the current week when nothing is left", () => {
        expect(landingWeek(events, "2026-12-01", 0)).toBe("2026-11-30");
        expect(landingWeek([], "2026-10-14", 0)).toBe("2026-10-12");
    });
});
