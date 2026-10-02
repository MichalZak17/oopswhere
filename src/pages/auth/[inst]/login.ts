import type { APIRoute } from "astro";
import { resolveInstallation, siteOrigin } from "@/lib/env";
import { safeReturnTo, writeOAuthState } from "@/lib/cookies";
import { authorizeUrl, requestToken } from "@/lib/usos/oauth";
import { track } from "@/lib/analytics/server";

/**
 * Step 1 of "Sign in with USOS": get a request token and send the browser to the
 * university's own login page. POST-only (Astro's checkOrigin guards it against CSRF).
 */
export const POST: APIRoute = async ({ params, request, url, cookies, redirect }) => {
    const inst = resolveInstallation(params.inst);
    if (!inst) return new Response("Unknown university", { status: 404 });

    const form = await request.formData().catch(() => null);
    const returnTo = safeReturnTo(form?.get("returnTo"));
    const home = returnTo.startsWith("/en") ? "/en/" : "/";
    if (!inst.consumer) return redirect(`${home}?auth=error`, 303);

    track("login_started", { inst: inst.id, lang: home === "/en/" ? "en" : "pl" });
    try {
        const callback = new URL(`/auth/${inst.id}/callback`, siteOrigin(url)).toString();
        const token = await requestToken(inst, callback);
        await writeOAuthState(cookies, url, {
            i: inst.id,
            k: token.key,
            s: token.secret,
            t: Date.now(),
            r: returnTo,
        });
        return redirect(authorizeUrl(inst, token.key), 303);
    } catch (err) {
        console.error(
            "[auth] request_token failed:",
            err instanceof Error ? err.message : "unknown",
        );
        track("login_finished", { inst: inst.id, outcome: "error", stage: "request_token" });
        return redirect(`${home}?auth=error`, 303);
    }
};

export const GET: APIRoute = ({ redirect }) => redirect("/", 303);
