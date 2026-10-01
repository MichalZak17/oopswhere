import { describe, expect, it } from "vitest";
import { layoutDay } from "./lanes";
import { activeWeekdays, hourRange } from "./visible-range";

const ev = (id: string, start: number, end: number) => ({ id, start, end });

describe("layoutDay", () => {
    it("puts the real Saturday clash side by side and flags only the clashing pair", () => {
        const r = layoutDay([
            ev("pad", 480, 570), // 8:00–9:30 PiAD LB
            ev("alg", 480, 570), // 8:00–9:30 Algorytmy 2 WK
            ev("test", 580, 670), // 9:40–11:10
            ev("lab", 685, 775), // 11:25–12:55
        ]);
        expect(r.get("pad")).toMatchObject({ lanes: 2, span: 1, conflict: true });
        expect(r.get("alg")).toMatchObject({ lanes: 2, span: 1, conflict: true });
        expect(new Set([r.get("pad")!.lane, r.get("alg")!.lane])).toEqual(new Set([0, 1]));
        expect(r.get("test")).toEqual({ lane: 0, lanes: 1, span: 1, conflict: false });
        expect(r.get("lab")).toEqual({ lane: 0, lanes: 1, span: 1, conflict: false });
    });

    it("treats touching events as non-overlapping", () => {
        const r = layoutDay([ev("a", 480, 570), ev("b", 570, 660)]);
        expect(r.get("a")).toMatchObject({ lanes: 1, conflict: false });
        expect(r.get("b")).toMatchObject({ lanes: 1, conflict: false });
    });

    it("reuses lanes in a chain and expands into free lanes", () => {
        // a 8–10, b 9–11, c 10:30–12  → a/c share lane 0, b lane 1
        const r = layoutDay([ev("a", 480, 600), ev("b", 540, 660), ev("c", 630, 720)]);
        expect(r.get("a")).toMatchObject({ lane: 0, lanes: 2, span: 1 });
        expect(r.get("b")).toMatchObject({ lane: 1, lanes: 2, span: 1 });
        expect(r.get("c")).toMatchObject({ lane: 0, lanes: 2, span: 1, conflict: true });
        // long event with a short one beside it, then a free lane
        const s = layoutDay([
            ev("long", 480, 720),
            ev("x", 480, 540),
            ev("y", 480, 540),
            ev("z", 600, 660),
        ]);
        expect(s.get("z")).toMatchObject({ lane: 1, span: 2, lanes: 3 });
    });

    it("handles many simultaneous events", () => {
        const r = layoutDay(Array.from({ length: 6 }, (_, i) => ev(`e${i}`, 480, 570)));
        expect([...r.values()].map((p) => p.lane).sort()).toEqual([0, 1, 2, 3, 4, 5]);
        expect([...r.values()].every((p) => p.lanes === 6 && p.conflict)).toBe(true);
    });
});

describe("visible range", () => {
    it("shows only days with classes, defaulting to Mon–Fri", () => {
        expect(activeWeekdays([5, 6, 5, 5])).toEqual([5, 6]);
        expect(activeWeekdays([])).toEqual([0, 1, 2, 3, 4]);
    });

    it("fits whole hours and pads to a minimum span", () => {
        expect(hourRange([{ start: 480, end: 775 }])).toEqual({ start: 480, end: 840 });
        expect(hourRange([{ start: 485, end: 1210 }])).toEqual({ start: 480, end: 1260 });
        expect(hourRange([])).toEqual({ start: 480, end: 960 });
    });
});
