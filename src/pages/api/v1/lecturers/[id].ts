import type { APIRoute } from "astro";
import { resolveInstallation } from "@/lib/env";
import { loadLecturerTimetable } from "@/lib/lecturers/load";
import { isStaffId } from "@/lib/lecturers/normalize";
import { jsonError, timetableResponse } from "@/lib/timetable/response";
import { trackTimetable } from "@/lib/analytics/server";

/** A lecturer's timetable for the running terms, for signed-in students. */
export const GET: APIRoute = async ({ params, locals, request }) => {
    const profile = locals.profile;
    if (!profile) return jsonError("not_signed_in", 401);
    const inst = resolveInstallation(profile.i);
    if (!inst) return jsonError("unknown_installation", 404);
    if (!isStaffId(params.id)) return jsonError("not_found", 404);

    const startedAt = Date.now();
    const result = await loadLecturerTimetable(inst, params.id, { budgetMs: 8000 });
    if (result.status === "gone") return jsonError("not_found", 404);
    if (result.status === "error") return jsonError("usos_unavailable", 502);
    trackTimetable("api", result.payload, result.groups, startedAt, "lecturer");
    return timetableResponse(request, result.payload);
};
