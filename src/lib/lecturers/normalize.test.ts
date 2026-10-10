import { describe, expect, it } from "vitest";
import {
    currentGroups,
    isStaffId,
    normalizeLecturer,
    normalizeLecturerData,
    normalizeQuery,
} from "./normalize";
import { fullName, plainName } from "./types";
import { relevantTerms } from "@/lib/terms";

// Shapes as ZUT returns them (users/user, groups/lecturer?active_terms=true), trimmed.
const user = {
    id: "1294960",
    first_name: "Łukasz",
    last_name: "Cierocki",
    titles: { before: "dr inż.", after: null },
    employment_positions: [
        {
            position: { id: "46", name: { pl: "asystent z dr.", en: "" } },
            faculty: {
                id: "KIOIC",
                name: { pl: "Katedra Inżynierii Oprogramowania i Cyberbezpieczeństwa", en: "" },
            },
        },
    ],
};
const taught = {
    groups: {
        "2026/2027-L": [{ course_unit_id: 72160, group_number: 11, term_id: "2026/2027-L" }],
        "2026/2027-Z": [
            { course_unit_id: 40497, group_number: 201, term_id: "2026/2027-Z" },
            { course_unit_id: "3512", group_number: "353", term_id: "2026/2027-Z" },
            { course_unit_id: 40497, group_number: 201, term_id: "2026/2027-Z" },
        ],
        "2025/2026-L": [{ course_unit_id: 37208, group_number: 1, term_id: "2025/2026-L" }],
    },
    terms: [
        {
            id: "2026/2027-L",
            start_date: "2027-03-01",
            end_date: "2027-09-30",
            finish_date: "2027-09-30",
        },
        {
            id: "2026/2027-Z",
            start_date: "2026-10-01",
            end_date: "2027-02-28",
            finish_date: "2027-02-28",
        },
        {
            id: "2025/2026-L",
            start_date: "2026-03-01",
            end_date: "2026-09-30",
            finish_date: "2026-09-30",
        },
    ],
};

describe("isStaffId", () => {
    it("accepts only positive integer ids", () => {
        expect(isStaffId("1294960")).toBe(true);
        for (const bad of ["", "0", "012", "-1", "1e5", "12345678901", "1 2", "../1", 12, null])
            expect(isStaffId(bad)).toBe(false);
    });
});

describe("normalizeQuery", () => {
    it("folds spacing and case into one cache key", () => {
        expect(normalizeQuery("  Łukasz   CIEROCKI ")).toBe("łukasz cierocki");
        expect(normalizeQuery("Łukasz".normalize("NFD"))).toBe("łukasz");
        expect(normalizeQuery("x".repeat(100))).toHaveLength(60);
        expect(normalizeQuery(null)).toBe("");
    });
});

describe("normalizeLecturer", () => {
    it("keeps titles apart and picks the department", () => {
        const l = normalizeLecturer(user);
        expect(l).toEqual({
            id: "1294960",
            first: "Łukasz",
            last: "Cierocki",
            before: "dr inż.",
            after: "",
            unit: { pl: "Katedra Inżynierii Oprogramowania i Cyberbezpieczeństwa" },
        });
        expect(fullName(l)).toBe("dr inż. Łukasz Cierocki");
        expect(plainName(l)).toBe("Łukasz Cierocki");
    });

    it("puts post-nominal titles after the name", () => {
        const l = normalizeLecturer({
            id: "23741",
            first_name: "Inga",
            last_name: "Kowalewska",
            titles: { before: "dr hab.", after: "prof. ZUT" },
        });
        expect(fullName(l)).toBe("dr hab. Inga Kowalewska, prof. ZUT");
        expect(l.unit).toBeNull();
    });
});

describe("lecturer groups", () => {
    const data = normalizeLecturerData(user, taught);

    it("dedupes groups and coerces ids", () => {
        expect(data.groups).toEqual([
            ["2026/2027-L", 72160, 11],
            ["2026/2027-Z", 40497, 201],
            ["2026/2027-Z", 3512, 353],
            ["2025/2026-L", 37208, 1],
        ]);
    });

    it("shows the running term only, until the next one is close", () => {
        expect(currentGroups(data, "2026-10-10")).toEqual([
            [40497, 201],
            [3512, 353],
        ]);
        // Within ~4 months of the summer term its groups join in, like a student's plan.
        expect(currentGroups(data, "2027-02-10")).toHaveLength(3);
    });

    it("falls back to every group when USOS sent no terms", () => {
        expect(currentGroups({ ...data, terms: [] }, "2026-10-10")).toHaveLength(4);
    });

    it("caps the group count", () => {
        expect(currentGroups(data, "2027-02-10", 2)).toHaveLength(2);
    });
});

describe("relevantTerms", () => {
    it("drops finished terms and ones that start far ahead", () => {
        expect(relevantTerms(taught.terms, "2026-10-10").map((t) => t.id)).toEqual(["2026/2027-Z"]);
        expect(relevantTerms([{ id: "open" }], "2026-10-10").map((t) => t.id)).toEqual(["open"]);
    });
});
