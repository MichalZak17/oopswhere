import { describe, expect, it } from "vitest";
import {
    addDays,
    diffDays,
    formatMinutes,
    isoWeek,
    parseUsosDateTime,
    startOfWeek,
    weekday,
} from "./local-date";
import { zonedNow } from "./zoned-now";

describe("local dates", () => {
    it("parses USOS naive times into wall-clock minutes", () => {
        expect(parseUsosDateTime("2026-10-10 08:00:00")).toEqual({
            date: "2026-10-10",
            minutes: 480,
        });
        expect(parseUsosDateTime("2026-10-11 11:25:00")).toEqual({
            date: "2026-10-11",
            minutes: 685,
        });
        expect(parseUsosDateTime("nope")).toBeNull();
    });

    it("does whole-day arithmetic across DST (Poland: 2026-10-25, 2026-03-29)", () => {
        expect(addDays("2026-10-24", 1)).toBe("2026-10-25");
        expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
        expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
        expect(diffDays("2026-10-19", "2026-10-26")).toBe(7);
        expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    });

    it("uses ISO weeks starting on Monday", () => {
        expect(weekday("2026-10-05")).toBe(0);
        expect(weekday("2026-10-10")).toBe(5);
        expect(weekday("2026-10-11")).toBe(6);
        expect(startOfWeek("2026-10-11")).toBe("2026-10-05");
        expect(startOfWeek("2026-10-25")).toBe("2026-10-19");
        expect(isoWeek("2026-10-05")).toBe(41);
        expect(isoWeek("2027-01-01")).toBe(53);
    });

    it("formats minutes", () => {
        expect(formatMinutes(480)).toBe("8:00");
        expect(formatMinutes(685)).toBe("11:25");
    });
});

describe("zonedNow", () => {
    it("reads Warsaw wall time regardless of the host timezone, across DST", () => {
        // CEST (UTC+2): 06:30Z → 08:30
        expect(zonedNow("Europe/Warsaw", new Date("2026-10-24T06:30:00Z"))).toEqual({
            today: "2026-10-24",
            nowMin: 510,
        });
        // CET (UTC+1) after the switch: 07:30Z → 08:30
        expect(zonedNow("Europe/Warsaw", new Date("2026-10-25T07:30:00Z"))).toEqual({
            today: "2026-10-25",
            nowMin: 510,
        });
        // Late evening UTC is already tomorrow in Warsaw
        expect(zonedNow("Europe/Warsaw", new Date("2026-10-10T22:30:00Z")).today).toBe(
            "2026-10-11",
        );
    });
});
