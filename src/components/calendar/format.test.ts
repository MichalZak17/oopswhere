import { describe, expect, it } from "vitest";
import { ago } from "./format";

describe("ago", () => {
    const min = 60_000;
    it("says 'just now' under a minute, including small clock skew", () => {
        expect(ago("pl", "przed chwilą", 40_000)).toBe("przed chwilą");
        expect(ago("en", "just now", -5_000)).toBe("just now");
    });
    it("uses minutes, then hours, then days", () => {
        expect(ago("pl", "", 12 * min)).toBe("12 min temu");
        expect(ago("en", "", 3 * 60 * min + 59 * min)).toBe("3 hr ago");
        expect(ago("pl", "", 2 * 24 * 60 * min)).toBe("2 dni temu");
    });
});
