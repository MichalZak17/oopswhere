/** The handful of USOS API methods oopswhere uses, with their raw response shapes. */
import type { ResolvedInstallation } from "@/lib/env";
import { usosCall, type Token } from "./client";

export type RawLang = { pl?: string | null; en?: string | null } | null | undefined;

export interface RawActivity {
    type: string;
    start_time: string;
    end_time: string;
    course_id?: string;
    course_name?: RawLang;
    classtype_id?: string;
    classtype_name?: RawLang;
    group_number?: number;
    unit_id?: number;
    lecturer_ids?: (number | string)[];
    building_id?: string | null;
    building_name?: RawLang;
    room_number?: string | null;
    room_id?: number | null;
    sm_id?: number;
    frequency?: string;
    classgroup_profile_url?: string | null;
}

export interface RawGroup {
    course_unit_id: number | string;
    group_number: number | string;
    class_type_id?: string;
    class_type?: RawLang;
    course_id?: string;
    course_name?: RawLang;
    term_id?: string;
    group_url?: string | null;
}

export interface RawTerm {
    id: string;
    name?: RawLang;
    start_date?: string;
    end_date?: string;
    finish_date?: string;
}

export interface RawUser {
    id: string;
    first_name?: string;
    last_name?: string;
    titles?: { before?: string | null; after?: string | null } | null;
}

const TT_FIELDS = [
    "type",
    "start_time",
    "end_time",
    "course_id",
    "course_name",
    "classtype_id",
    "classtype_name",
    "group_number",
    "unit_id",
    "lecturer_ids",
    "building_id",
    "building_name",
    "room_number",
    "room_id",
    "sm_id",
    "classgroup_profile_url",
].join("|");

const GROUP_FIELDS =
    "course_unit_id|group_number|class_type_id|class_type|course_id|course_name|term_id|group_url";

/** Every meeting of a class group in its term. Anonymous. */
export function classgroupDates(inst: ResolvedInstallation, unitId: number, groupNumber: number) {
    return usosCall<RawActivity[]>(inst, "tt/classgroup_dates2", {
        params: { unit_id: unitId, group_number: groupNumber, fields: TT_FIELDS },
    });
}

/** Group metadata — used when a group has no meetings yet. Anonymous. */
export function groupInfo(inst: ResolvedInstallation, unitId: number, groupNumber: number) {
    return usosCall<RawGroup>(inst, "groups/group", {
        params: { course_unit_id: unitId, group_number: groupNumber, fields: GROUP_FIELDS },
    });
}

/** The signed-in student's groups, keyed by term. Needs a user token (scope: studies). */
export function participantGroups(inst: ResolvedInstallation, token: Token) {
    return usosCall<{ groups: Record<string, RawGroup[]>; terms?: RawTerm[] }>(
        inst,
        "groups/participant",
        {
            // Never request `participants`: that would pull classmates' data.
            params: { fields: "course_unit_id|group_number|class_type_id|course_id|term_id" },
            token,
        },
    );
}

/** Only the first name, for "Cześć, …" — no ids, no email. */
export function currentUser(inst: ResolvedInstallation, token: Token) {
    return usosCall<RawUser>(inst, "users/user", { params: { fields: "first_name" }, token });
}

/** Lecturers with academic titles. Needs only the consumer key. */
export function usersByIds(inst: ResolvedInstallation, ids: string[]) {
    return usosCall<Record<string, RawUser | null>>(inst, "users/users", {
        params: { user_ids: ids.join("|"), fields: "id|first_name|last_name|titles" },
        signed: true,
    });
}

/** Terms running between two dates. Anonymous. */
export function termsBetween(inst: ResolvedInstallation, from: string, to: string) {
    return usosCall<RawTerm[]>(inst, "terms/search", {
        params: { min_finish_date: from, max_start_date: to },
    });
}
