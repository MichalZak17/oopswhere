import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { installations } from "@/config/installations";
import type { RawActivity, RawGroup } from "@/lib/usos/api";
import { langText, normalizeGroup, normalizePerson } from "./normalize";

const fixture = <T>(name: string): T =>
    JSON.parse(
        readFileSync(new URL(`../../../tests/fixtures/zut/${name}`, import.meta.url), "utf8"),
    ) as T;

const zut = installations.zut;

describe("normalizeGroup (real ZUT fixtures)", () => {
    it("turns classgroup_dates2 into compact meetings", () => {
        const raw = fixture<RawActivity[]>("classgroup_dates2/17879-321.json");
        const g = normalizeGroup(zut, 17879, 321, raw);
        expect(g.key).toBe("17879-321");
        expect(g.info).toMatchObject({
            courseId: "IIN-N1-5-XXZ>0AGZ-LB",
            course: { pl: "Przetwarzanie i analiza danych" },
            type: "LB",
            group: 321,
        });
        expect(g.info.course.en).toBeUndefined(); // ZUT sends "" — dropped
        const first = g.meetings[0];
        expect(first).toEqual([
            "17879-321",
            "2026-10-10",
            480,
            570,
            "303",
            "WI_WI1",
            expect.any(Array),
            expect.any(Number),
        ]);
        expect(g.buildings.WI_WI1).toEqual({
            label: "WI1",
            name: { pl: "WI Wydział Informatyki 1" },
        });
        // sorted, unique
        const keys = g.meetings.map((m) => `${m[1]} ${m[2]}`);
        expect([...keys].sort()).toEqual(keys);
        expect(new Set(keys).size).toBe(keys.length);
    });

    it("covers the Sunday language class", () => {
        const g = normalizeGroup(
            zut,
            35564,
            1,
            fixture<RawActivity[]>("classgroup_dates2/35564-1.json"),
        );
        expect(g.info.type).toBe("LK");
        expect(g.meetings.find((m) => m[1] === "2026-10-11")?.slice(0, 6)).toEqual([
            "35564-1",
            "2026-10-11",
            480,
            660,
            "10",
            "WI_WI2",
        ]);
    });

    it("falls back to group metadata when there are no meetings", () => {
        const info = fixture<RawGroup>("groups_group/5400-2.json");
        const g = normalizeGroup(zut, 5400, 2, [], info);
        expect(g.meetings).toEqual([]);
        expect(g.info.course.pl).toBe("Algorytmy 2");
        expect(g.info.type).toBe("WK");
    });

    it("skips irregular classgroup guesses and invalid rows", () => {
        const g = normalizeGroup(zut, 1, 1, [
            {
                type: "classgroup",
                frequency: "other",
                start_time: "2026-10-10 08:00:00",
                end_time: "2026-10-10 09:00:00",
            },
            { type: "exam", start_time: "2026-10-10 08:00:00", end_time: "2026-10-10 09:00:00" },
            { type: "classgroup2", start_time: "bad", end_time: "2026-10-10 09:00:00" },
            {
                type: "classgroup2",
                start_time: "2026-10-10 10:00:00",
                end_time: "2026-10-10 09:00:00",
            },
        ]);
        expect(g.meetings).toEqual([]);
    });
});

describe("helpers", () => {
    it("langText drops empty English", () => {
        expect(langText({ pl: "Sala", en: "" })).toEqual({ pl: "Sala" });
        expect(langText({ pl: "", en: "Room" })).toEqual({ pl: "Room", en: "Room" });
        expect(langText(null)).toEqual({ pl: "" });
    });

    it("normalizePerson joins academic titles", () => {
        expect(
            normalizePerson({
                id: "1",
                first_name: "Przemysław",
                last_name: "Klęsk",
                titles: { before: "dr hab. inż.", after: "prof. ZUT" },
            }),
        ).toEqual(["Przemysław", "Klęsk", "dr hab. inż. prof. ZUT"]);
    });
});
