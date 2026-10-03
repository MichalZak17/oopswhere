/**
 * Builds a student's whole-term timetable from public, per-group USOS data.
 * Everything here is shared-cacheable: a class group's schedule is the same for
 * every student in it, so a popular group costs USOS one request per half hour.
 */
import type { ResolvedInstallation } from "@/lib/env";
import { Limiter } from "@/lib/cache/limit";
import { createSwr } from "@/lib/cache/swr";
import { store, waitUntil } from "@/lib/platform";
import { zonedNow } from "@/lib/time/zoned-now";
import { classgroupDates, groupInfo, usersByIds } from "@/lib/usos/api";
import { UsosError } from "@/lib/usos/client";
import {
    groupKey,
    normalizeGroup,
    normalizePerson,
    type GroupData,
    type Person,
} from "./normalize";
import type { GroupKey, TimetablePayload } from "./types";

const limiter = new Limiter({ concurrency: 6, failureThreshold: 5, cooldownMs: 60_000 });
const isPermanent = (err: unknown) => err instanceof UsosError && err.kind === "not_found";
const isUpstreamFailure = (err: unknown) =>
    err instanceof UsosError &&
    (err.kind === "upstream" || err.kind === "timeout" || err.kind === "network");

const swr = createSwr({ store, waitUntil, isPermanent });

const PEOPLE_POLICY = { freshSec: 7 * 86_400, swrSec: 30 * 86_400, maxStaleSec: 90 * 86_400 };

async function fetchGroup(
    inst: ResolvedInstallation,
    unitId: number,
    groupNumber: number,
): Promise<GroupData> {
    const activities = await limiter.run(
        () => classgroupDates(inst, unitId, groupNumber),
        isUpstreamFailure,
    );
    const fallback =
        activities.length === 0
            ? await limiter
                  .run(() => groupInfo(inst, unitId, groupNumber), isUpstreamFailure)
                  .catch(() => null)
            : null;
    return normalizeGroup(inst, unitId, groupNumber, activities, fallback);
}

type GroupOutcome =
    | { status: "ok"; data: GroupData; stale: boolean; storedAt: number }
    | { status: "gone" }
    | { status: "missing" };

async function loadGroup(
    inst: ResolvedInstallation,
    unitId: number,
    groupNumber: number,
): Promise<GroupOutcome> {
    try {
        const { value, stale, storedAt } = await swr(
            `tt:v1:${inst.id}:${groupKey(unitId, groupNumber)}`,
            () => fetchGroup(inst, unitId, groupNumber),
            inst.tt,
        );
        return { status: "ok", data: value, stale, storedAt };
    } catch (err) {
        return isPermanent(err) ? { status: "gone" } : { status: "missing" };
    }
}

async function loadPeople(
    inst: ResolvedInstallation,
    ids: string[],
): Promise<Record<string, Person>> {
    if (ids.length === 0 || !inst.consumer) return {};
    const out: Record<string, Person> = {};
    const todo: string[] = [];
    const now = Date.now();
    await Promise.all(
        ids.map(async (id) => {
            const hit = await store.get<Person>(`person:v1:${inst.id}:${id}`).catch(() => null);
            if (hit) out[id] = hit.value;
            if (!hit || now - hit.storedAt > PEOPLE_POLICY.freshSec * 1000) todo.push(id);
        }),
    );
    for (let i = 0; i < todo.length; i += 50) {
        const batch = todo.slice(i, i + 50);
        try {
            const users = await limiter.run(() => usersByIds(inst, batch), isUpstreamFailure);
            for (const [id, raw] of Object.entries(users)) {
                if (!raw) continue;
                const person = normalizePerson(raw);
                out[id] = person;
                await store.set(
                    `person:v1:${inst.id}:${id}`,
                    { value: person, storedAt: now },
                    PEOPLE_POLICY.maxStaleSec,
                );
            }
        } catch {
            // Names are a nicety; the timetable still renders without them.
        }
    }
    return out;
}

/** Resolves `p`, or `onTimeout` if `deadline` (epoch ms) passes first. */
function withDeadline<T>(p: Promise<T>, deadline: number, onTimeout: T): Promise<T> {
    const ms = deadline - Date.now();
    if (!Number.isFinite(ms)) return p;
    if (ms <= 0) return Promise.resolve(onTimeout);
    return new Promise<T>((resolve) => {
        const timer = setTimeout(() => resolve(onTimeout), ms);
        p.then(
            (v) => {
                clearTimeout(timer);
                resolve(v);
            },
            () => {
                clearTimeout(timer);
                resolve(onTimeout);
            },
        );
    });
}

export interface LoadOptions {
    /** Give up on slow groups after this long; they are listed in `missing`. */
    budgetMs?: number;
}

export async function loadTimetable(
    inst: ResolvedInstallation,
    groups: readonly (readonly [number, number])[],
    opts: LoadOptions = {},
): Promise<TimetablePayload> {
    const deadline = opts.budgetMs ? Date.now() + opts.budgetMs : Infinity;

    const outcomes = await Promise.all(
        groups.map(async ([unit, grp]) => {
            const p = loadGroup(inst, unit, grp);
            // Let slow fetches finish in the background so the cache is warm next time.
            waitUntil(p);
            return [
                groupKey(unit, grp),
                await withDeadline(p, deadline, { status: "missing" } as GroupOutcome),
            ] as const;
        }),
    );

    const payload: TimetablePayload = {
        v: 1,
        inst: inst.id,
        timeZone: inst.timeZone,
        generatedAt: new Date().toISOString(),
        updatedAt: null,
        ...zonedNow(inst.timeZone),
        groups: {},
        people: {},
        buildings: {},
        meetings: [],
        missing: [],
        stale: [],
        gone: [],
    };

    let oldest = Infinity;
    for (const [key, outcome] of outcomes) {
        if (outcome.status === "ok") {
            oldest = Math.min(oldest, outcome.storedAt);
            payload.groups[key] = outcome.data.info;
            Object.assign(payload.buildings, outcome.data.buildings);
            payload.meetings.push(...outcome.data.meetings);
            if (outcome.stale) payload.stale.push(key);
        } else if (outcome.status === "gone") {
            payload.gone.push(key);
        } else {
            payload.missing.push(key as GroupKey);
        }
    }
    if (Number.isFinite(oldest)) payload.updatedAt = new Date(oldest).toISOString();
    payload.meetings.sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[2] - b[2]));

    const ids = [...new Set(payload.meetings.flatMap((m) => m[6]))].map(String);
    const peoplePromise = loadPeople(inst, ids);
    waitUntil(peoplePromise);
    payload.people = await withDeadline(
        peoplePromise,
        deadline === Infinity ? Infinity : Math.max(deadline, Date.now() + 400),
        {},
    );
    return payload;
}
