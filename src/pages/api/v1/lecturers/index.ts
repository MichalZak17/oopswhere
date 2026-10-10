import type { APIRoute } from "astro";
import { resolveInstallation } from "@/lib/env";
import { searchLecturers } from "@/lib/lecturers/load";
import type { LecturerSearchResult } from "@/lib/lecturers/types";
import { jsonError } from "@/lib/timetable/response";

/**
 * Lecturer search for signed-in students: GET ?q=name. Runs on our consumer key, so it
 * stays behind the profile cookie. The query is never logged.
 */
export const GET: APIRoute = async ({ url, locals }) => {
    const profile = locals.profile;
    if (!profile) return jsonError("not_signed_in", 401);
    const inst = resolveInstallation(profile.i);
    if (!inst) return jsonError("unknown_installation", 404);

    let items;
    try {
        items = await searchLecturers(inst, url.searchParams.get("q"));
    } catch {
        return jsonError("usos_unavailable", 502);
    }
    const body: LecturerSearchResult = { items };
    // Public data, but only for signed-in visitors: the browser may reuse it, nobody else.
    return Response.json(body, {
        headers: { "Cache-Control": "private, max-age=300", Vary: "Cookie" },
    });
};
