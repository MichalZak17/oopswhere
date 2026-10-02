import type { APIRoute } from "astro";
import { THEME_COOKIE } from "@/lib/cookies";
import { isHttps } from "@/lib/env";
import { asTheme } from "@/lib/theme";
import { safeReturnTo } from "@/lib/return-to";

const ALLOWED = new Set(["/privacy", "/en/privacy"]);

/** Switches theme without JavaScript: remember the choice (auto = forget it), go back. */
export const GET: APIRoute = ({ params, url, cookies, redirect }) => {
    const theme = asTheme(params.theme);
    if (theme === "auto") {
        cookies.delete(THEME_COOKIE, { path: "/" });
    } else {
        cookies.set(THEME_COOKIE, theme, {
            path: "/",
            maxAge: 365 * 24 * 60 * 60,
            sameSite: "lax",
            secure: isHttps(url),
        });
    }
    const to = url.searchParams.get("to") ?? "";
    return redirect(ALLOWED.has(to) ? to : safeReturnTo(to), 303);
};
