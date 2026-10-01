import type { APIRoute } from "astro";
import { LANG_COOKIE } from "@/lib/cookies";

const ALLOWED = new Set(["/", "/demo", "/privacy", "/en/", "/en/demo", "/en/privacy"]);

/** Switches language without JavaScript: remember the choice, go to the localized page. */
export const GET: APIRoute = ({ params, url, cookies, redirect }) => {
    const lang = params.lang === "en" ? "en" : "pl";
    cookies.set(LANG_COOKIE, lang, {
        path: "/",
        maxAge: 365 * 24 * 60 * 60,
        sameSite: "lax",
        secure: url.protocol === "https:",
    });
    const to = url.searchParams.get("to") ?? "";
    const fallback = lang === "en" ? "/en/" : "/";
    return redirect(ALLOWED.has(to) ? to : fallback, 303);
};
