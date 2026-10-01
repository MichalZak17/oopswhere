import { describe, expect, it } from "vitest";
import { seal } from "@/lib/crypto/seal";
import { isProfile, needsRefresh, type Profile } from "./profile";
import { safeReturnTo } from "./return-to";

const profile = (groups: number): Profile => ({
    v: 1,
    i: "zut",
    n: "Michał",
    a: 1_790_000_000,
    t: [
        ["2026/2027-Z", "2027-02-28"],
        ["2026/2027", "2027-09-30"],
    ],
    g: Array.from({ length: groups }, (_, i) => [17879 + i * 37, 300 + i] as [number, number]),
});

describe("profile", () => {
    it("validates shape", () => {
        expect(isProfile(profile(3))).toBe(true);
        expect(isProfile({ ...profile(3), v: 2 })).toBe(false);
        expect(isProfile({ ...profile(3), g: [[1, "x"]] })).toBe(false);
        expect(isProfile(null)).toBe(false);
    });

    it("stays far below the 4 KB cookie limit", async () => {
        const secret = "s".repeat(43);
        expect((await seal(profile(15), secret, "profile")).length).toBeLessThan(600);
        expect((await seal(profile(60), secret, "profile")).length).toBeLessThan(1300);
        expect((await seal(profile(150), secret, "profile")).length).toBeLessThan(3000);
    });

    it("asks for a refresh only when every term is over", () => {
        expect(needsRefresh(profile(1), "2026-10-10")).toBe(false);
        expect(needsRefresh(profile(1), "2027-03-01")).toBe(false);
        expect(needsRefresh(profile(1), "2027-10-01")).toBe(true);
    });
});

describe("safeReturnTo", () => {
    it("accepts only our own pages", () => {
        for (const ok of [
            "/",
            "/en/",
            "/demo",
            "/en/demo",
            "/?week=2026-10-05",
            "/en/?week=2026-10-05",
        ]) {
            expect(safeReturnTo(ok)).toBe(ok);
        }
        for (const bad of [
            "//evil.com",
            "https://evil.com",
            "/\\evil",
            "javascript:alert(1)",
            "/en/../../x",
            "/?week=<x>",
            42,
            null,
        ]) {
            expect(safeReturnTo(bad)).toBe("/");
        }
    });
});
