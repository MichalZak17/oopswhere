import { describe, expect, it } from "vitest";
import { asConsent, consentFromCookies } from "./consent";

describe("asConsent", () => {
    it("accepts only yes and no", () => {
        expect(asConsent("yes")).toBe("yes");
        expect(asConsent("no")).toBe("no");
        expect(asConsent("YES")).toBeNull();
        expect(asConsent("")).toBeNull();
        expect(asConsent(undefined)).toBeNull();
    });
});

describe("consentFromCookies", () => {
    it("finds the answer among other cookies", () => {
        expect(consentFromCookies("ow_consent=yes")).toBe("yes");
        expect(consentFromCookies("ow_theme=dark; ow_consent=no; ow_lang=en")).toBe("no");
    });

    it("ignores missing, unknown and look-alike cookies", () => {
        expect(consentFromCookies("")).toBeNull();
        expect(consentFromCookies("ow_consent=maybe")).toBeNull();
        expect(consentFromCookies("x_ow_consent=yes")).toBeNull();
    });
});
