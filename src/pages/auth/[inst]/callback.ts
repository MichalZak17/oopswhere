import type { APIRoute } from "astro";
import { resolveInstallation } from "@/lib/env";
import { takeOAuthState, writeProfile } from "@/lib/cookies";
import { MAX_GROUPS, type Profile } from "@/lib/profile";
import { zonedNow } from "@/lib/time/zoned-now";
import { addDays } from "@/lib/time/local-date";
import { loadTimetable } from "@/lib/timetable/load";
import { accessToken, revokeToken } from "@/lib/usos/oauth";
import { currentUser, participantGroups, termsBetween, type RawTerm } from "@/lib/usos/api";
import type { Token } from "@/lib/usos/client";

function constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

/**
 * Step 2: USOS sends the user back here. We exchange the verifier for a short-lived
 * access token, read the group list and first name, revoke the token, and keep only
 * that list — sealed in the user's own cookie.
 */
export const GET: APIRoute = async ({ params, url, cookies, redirect }) => {
    const state = await takeOAuthState(cookies, url);
    const home = state?.r.startsWith("/en") ? "/en/" : "/";
    const fail = (code: string) => {
        const r = redirect(`${home}?auth=${code}`, 303);
        r.headers.set("Cache-Control", "no-store");
        r.headers.set("Referrer-Policy", "no-referrer");
        return r;
    };

    const inst = resolveInstallation(params.inst);
    const oauthToken = url.searchParams.get("oauth_token") ?? "";
    const verifier = url.searchParams.get("oauth_verifier");
    if (!inst || !state || state.i !== inst.id || !constantTimeEqual(oauthToken, state.k))
        return fail("expired");
    if (!verifier) return fail("denied");

    let token: Token | null = null;
    let profile: Profile;
    try {
        token = await accessToken(inst, { key: state.k, secret: state.s }, verifier);
        const [participant, user] = await Promise.all([
            participantGroups(inst, token),
            currentUser(inst, token).catch(() => null),
        ]);

        const { today } = zonedNow(inst.timeZone);
        let terms: RawTerm[] = participant.terms ?? [];
        if (terms.length === 0)
            terms = await termsBetween(inst, today, addDays(today, 120)).catch(() => []);
        // Keep terms that haven't finished and start within the next ~4 months.
        const horizon = addDays(today, 120);
        const relevant = terms.filter(
            (t) =>
                (t.finish_date ?? t.end_date ?? "9999") >= today &&
                (t.start_date ?? "0000") <= horizon,
        );
        const termIds = new Set(relevant.map((t) => t.id));

        const seen = new Set<string>();
        const groups: [number, number][] = [];
        for (const [termId, list] of Object.entries(participant.groups ?? {})) {
            if (termIds.size > 0 && !termIds.has(termId)) continue;
            for (const g of list) {
                const unit = Number(g.course_unit_id);
                const num = Number(g.group_number);
                const key = `${unit}-${num}`;
                if (!Number.isInteger(unit) || !Number.isInteger(num) || seen.has(key)) continue;
                seen.add(key);
                groups.push([unit, num]);
            }
        }

        profile = {
            v: 1,
            i: inst.id,
            n: (user?.first_name ?? "").trim().slice(0, 40),
            a: Math.floor(Date.now() / 1000),
            t: relevant.map(
                (t) => [t.id, t.finish_date ?? t.end_date ?? today] as [string, string],
            ),
            g: groups.slice(0, MAX_GROUPS),
        };
    } catch (err) {
        console.error("[auth] callback failed:", err instanceof Error ? err.message : "unknown");
        return fail("error");
    } finally {
        if (token) await revokeToken(inst, token);
    }

    if (profile.g.length === 0) return fail("nogroups");

    // Warm the shared cache so the first calendar render is instant.
    await loadTimetable(inst, profile.g, { budgetMs: 2500 }).catch(() => null);

    await writeProfile(cookies, url, profile);
    const r = redirect(state.r, 303);
    r.headers.set("Cache-Control", "no-store");
    r.headers.set("Referrer-Policy", "no-referrer");
    return r;
};
