import type { APIRoute } from "astro";
import { DEFAULT_INSTALLATION } from "@/config/installations";
import { DEMO_GROUPS } from "@/config/demo";
import { demoEnabled, resolveInstallation } from "@/lib/env";
import { loadTimetable } from "@/lib/timetable/load";
import { trackTimetable } from "@/lib/analytics/server";

async function etagOf(body: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
    const hex = Array.from(new Uint8Array(digest).slice(0, 12), (b) =>
        b.toString(16).padStart(2, "0"),
    ).join("");
    return `"${hex}"`;
}

/** The signed-in student's whole-term timetable (or the demo's) as JSON. */
export const GET: APIRoute = async ({ url, locals, request }) => {
    const demo = url.searchParams.get("demo") === "1";
    if (demo && !demoEnabled()) {
        return Response.json(
            { error: "not_found" },
            { status: 404, headers: { "Cache-Control": "no-store" } },
        );
    }
    const profile = demo ? null : locals.profile;
    if (!demo && !profile) {
        return Response.json(
            { error: "not_signed_in" },
            { status: 401, headers: { "Cache-Control": "no-store" } },
        );
    }
    const inst = resolveInstallation(profile?.i ?? DEFAULT_INSTALLATION);
    if (!inst) return Response.json({ error: "unknown_installation" }, { status: 404 });

    const groups = demo ? (DEMO_GROUPS[inst.id] ?? []) : profile!.g;
    const startedAt = Date.now();
    const payload = await loadTimetable(inst, groups, { budgetMs: 8000 });
    trackTimetable("api", payload, groups.length, startedAt, demo);
    // generatedAt/now change every call; leave them out of the validator.
    const etag = await etagOf(JSON.stringify({ ...payload, generatedAt: 0, nowMin: 0 }));
    const headers = {
        "Cache-Control": "private, no-cache",
        ETag: etag,
        Vary: "Cookie",
    };
    if (request.headers.get("If-None-Match") === etag)
        return new Response(null, { status: 304, headers });
    return Response.json(payload, { headers });
};
