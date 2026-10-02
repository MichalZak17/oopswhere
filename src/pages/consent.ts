import type { APIRoute } from "astro";
import { CONSENT_COOKIE, CONSENT_MAX_AGE, asConsent } from "@/lib/consent";
import { isHttps } from "@/lib/env";
import { safeReturnTo } from "@/lib/return-to";

const ALLOWED = new Set(["/privacy", "/en/privacy"]);

/**
 * Records the answer to the analytics question without JavaScript, then goes back.
 * POST, not a link like /theme: the middleware's Origin check means another site can't
 * record a "yes" on someone's behalf.
 */
export const POST: APIRoute = async ({ request, url, cookies, redirect }) => {
    const form = await request.formData().catch(() => null);
    const choice = asConsent(form?.get("choice"));
    if (choice) {
        cookies.set(CONSENT_COOKIE, choice, {
            path: "/",
            maxAge: CONSENT_MAX_AGE,
            sameSite: "lax",
            secure: isHttps(url),
        });
    }
    const to = String(form?.get("to") ?? "");
    return redirect(ALLOWED.has(to) ? to : safeReturnTo(to), 303);
};
