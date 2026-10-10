import { describe, expect, it } from "vitest";
import { scrubProperties, scrubUrl } from "./scrub";

describe("analytics scrubbing", () => {
    it("hides lecturer ids in any URL or path", () => {
        expect(scrubUrl("https://oopswhere.com/lecturer/1294960?week=2026-10-12")).toBe(
            "https://oopswhere.com/lecturer/[id]?week=2026-10-12",
        );
        expect(scrubUrl("/en/lecturer/34016")).toBe("/en/lecturer/[id]");
        expect(scrubUrl("https://oopswhere.com/?week=2026-10-12")).toBe(
            "https://oopswhere.com/?week=2026-10-12",
        );
    });

    it("rewrites every string property, leaves the rest", () => {
        const props: Record<string, unknown> = {
            $current_url: "https://oopswhere.com/lecturer/1294960",
            $pathname: "/lecturer/1294960",
            $referrer: "https://oopswhere.com/lecturer/23741",
            groups: 6,
        };
        scrubProperties(props);
        expect(props).toEqual({
            $current_url: "https://oopswhere.com/lecturer/[id]",
            $pathname: "/lecturer/[id]",
            $referrer: "https://oopswhere.com/lecturer/[id]",
            groups: 6,
        });
        expect(() => scrubProperties(undefined)).not.toThrow();
    });
});
