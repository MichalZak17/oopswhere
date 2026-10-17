/**
 * Lecturer search and lecturer timetables, all from public USOS data. A lecturer's plan is
 * just another list of class groups: it goes through the same loader and per-group cache
 * as a student's, so groups shared with students cost USOS nothing extra.
 */
import type { ResolvedInstallation } from "@/lib/env";
import { MemoryStore } from "@/lib/cache/store";
import { createSwr } from "@/lib/cache/swr";
import { store, waitUntil } from "@/lib/platform";
import { zonedNow } from "@/lib/time/zoned-now";
import {
    isPermanent,
    isUpstreamFailure,
    limiter,
    loadTimetable,
    type LoadOptions,
} from "@/lib/timetable/load";
import type { TimetablePayload } from "@/lib/timetable/types";
import { lecturerGroups, searchTeachers, staffMember } from "@/lib/usos/api";
import { UsosError } from "@/lib/usos/client";
import {
    currentGroups,
    normalizeLecturer,
    normalizeLecturerData,
    normalizeQuery,
    onlyTheirMeetings,
    type LecturerData,
} from "./normalize";
import { MIN_QUERY, type Lecturer } from "./types";

/** Who teaches what changes a few times a term at most. */
const LECTURER_POLICY = { freshSec: 6 * 3600, swrSec: 24 * 3600, maxStaleSec: 14 * 86_400 };
/** Search results: the staff list barely moves; a day keeps repeated queries off USOS. */
const SEARCH_POLICY = { freshSec: 86_400, swrSec: 2 * 86_400, maxStaleSec: 2 * 86_400 };
const GONE_TTL_SEC = 3600;

const swr = createSwr({ store, waitUntil, isPermanent });
// Queries get their own small LRU so a burst of searches can't evict timetables.
const searchSwr = createSwr({ store: new MemoryStore(1000), waitUntil });

export async function searchLecturers(
    inst: ResolvedInstallation,
    rawQuery: unknown,
): Promise<Lecturer[]> {
    const query = normalizeQuery(rawQuery);
    if (query.length < MIN_QUERY || !inst.consumer) return [];
    const { value } = await searchSwr(
        `lsearch:v1:${inst.id}:${query}`,
        async () => {
            const res = await limiter.run(() => searchTeachers(inst, query), isUpstreamFailure);
            return (res.items ?? []).map((item) => normalizeLecturer(item.user));
        },
        SEARCH_POLICY,
    );
    return value;
}

async function fetchLecturer(inst: ResolvedInstallation, id: string): Promise<LecturerData> {
    const [user, taught] = await Promise.all([
        limiter.run(() => staffMember(inst, id), isUpstreamFailure),
        limiter.run(() => lecturerGroups(inst, id), isUpstreamFailure),
    ]);
    // Only people who teach get a page: a student's id must not turn into a name lookup.
    const groupCount = Object.values(taught.groups ?? {}).reduce((n, g) => n + g.length, 0);
    if (!user || groupCount === 0) throw new UsosError("Not a lecturer", 404, "not_found");
    return normalizeLecturerData(user, taught);
}

export type LecturerOutcome =
    { status: "ok"; data: LecturerData } | { status: "gone" } | { status: "error" };

export async function loadLecturer(
    inst: ResolvedInstallation,
    id: string,
): Promise<LecturerOutcome> {
    if (!inst.consumer) return { status: "error" };
    const goneKey = `lect-gone:v1:${inst.id}:${id}`;
    if (await store.get(goneKey).catch(() => null)) return { status: "gone" };
    try {
        const { value } = await swr(
            `lect:v1:${inst.id}:${id}`,
            () => fetchLecturer(inst, id),
            LECTURER_POLICY,
        );
        return { status: "ok", data: value };
    } catch (err) {
        if (!isPermanent(err)) return { status: "error" };
        // Remember misses for a while, so guessing ids doesn't turn into USOS traffic.
        await store.set(goneKey, { value: true, storedAt: Date.now() }, GONE_TTL_SEC);
        return { status: "gone" };
    }
}

/** A lecturer and their timetable for the terms running now. */
export async function loadLecturerTimetable(
    inst: ResolvedInstallation,
    id: string,
    opts: LoadOptions,
): Promise<
    | { status: "ok"; lecturer: Lecturer; payload: TimetablePayload; groups: number }
    | Exclude<LecturerOutcome, { status: "ok" }>
> {
    const outcome = await loadLecturer(inst, id);
    if (outcome.status !== "ok") return outcome;
    const groups = currentGroups(outcome.data, zonedNow(inst.timeZone).today);
    const payload = onlyTheirMeetings(await loadTimetable(inst, groups, opts), id);
    return { status: "ok", lecturer: outcome.data.lecturer, payload, groups: groups.length };
}
