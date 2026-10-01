/**
 * The only thing oopswhere remembers about a student, sealed in their own cookie:
 * a first name and the list of class groups. No tokens, no USOS id, no email.
 */
import type { LocalDate } from "@/lib/time/local-date";

export interface Profile {
    v: 1;
    /** Installation id. */
    i: string;
    /** First name, for the greeting. */
    n: string;
    /** When the group list was fetched (unix seconds). */
    a: number;
    /** Terms the groups belong to: [termId, finish date]. */
    t: [string, LocalDate][];
    /** Class groups: [unitId, groupNumber]. */
    g: [number, number][];
}

export const MAX_GROUPS = 150;

export function isProfile(x: unknown): x is Profile {
    if (!x || typeof x !== "object") return false;
    const p = x as Partial<Profile>;
    return (
        p.v === 1 &&
        typeof p.i === "string" &&
        typeof p.n === "string" &&
        typeof p.a === "number" &&
        Array.isArray(p.t) &&
        Array.isArray(p.g) &&
        p.g.length <= MAX_GROUPS &&
        p.g.every(
            (g) =>
                Array.isArray(g) &&
                g.length === 2 &&
                Number.isInteger(g[0]) &&
                Number.isInteger(g[1]),
        )
    );
}

/** True when every stored term is over — time to fetch the new semester's groups. */
export function needsRefresh(profile: Profile, today: LocalDate): boolean {
    return profile.t.length > 0 && profile.t.every(([, finish]) => finish < today);
}
