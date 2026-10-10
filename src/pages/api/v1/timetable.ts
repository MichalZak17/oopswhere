import type { APIRoute } from "astro";
import { DEFAULT_INSTALLATION } from "@/config/installations";
import { DEMO_GROUPS } from "@/config/demo";
import { demoEnabled, resolveInstallation } from "@/lib/env";
import { loadTimetable } from "@/lib/timetable/load";
import { jsonError, timetableResponse } from "@/lib/timetable/response";
import { trackTimetable } from "@/lib/analytics/server";

/** The signed-in student's whole-term timetable (or the demo's) as JSON. */
export const GET: APIRoute = async ({ url, locals, request }) => {
    const demo = url.searchParams.get("demo") === "1";
    if (demo && !demoEnabled()) return jsonError("not_found", 404);
    const profile = demo ? null : locals.profile;
    if (!demo && !profile) return jsonError("not_signed_in", 401);
    const inst = resolveInstallation(profile?.i ?? DEFAULT_INSTALLATION);
    if (!inst) return jsonError("unknown_installation", 404);

    const groups = demo ? (DEMO_GROUPS[inst.id] ?? []) : profile!.g;
    const startedAt = Date.now();
    const payload = await loadTimetable(inst, groups, { budgetMs: 8000 });
    trackTimetable("api", payload, groups.length, startedAt, demo ? "demo" : "own");
    return timetableResponse(request, payload);
};
