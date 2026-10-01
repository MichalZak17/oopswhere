/** Raw USOS responses → the compact, render-ready shapes in ./types. */
import { buildingLabel, type Installation } from "@/config/installations";
import { parseUsosDateTime } from "@/lib/time/local-date";
import type { RawActivity, RawGroup, RawLang, RawUser } from "@/lib/usos/api";
import type { BuildingInfo, GroupInfo, GroupKey, LangText, MeetingTuple } from "./types";

export function langText(raw: RawLang): LangText {
    const pl = raw?.pl?.trim() ?? "";
    const en = raw?.en?.trim() ?? "";
    return en ? { pl: pl || en, en } : { pl };
}

export const groupKey = (unitId: number, groupNumber: number): GroupKey =>
    `${unitId}-${groupNumber}`;

export interface GroupData {
    key: GroupKey;
    info: GroupInfo;
    meetings: MeetingTuple[];
    buildings: Record<string, BuildingInfo>;
}

const MEETING_TYPES = new Set(["classgroup", "classgroup2"]);

export function normalizeGroup(
    inst: Installation,
    unitId: number,
    groupNumber: number,
    activities: RawActivity[],
    fallback?: RawGroup | null,
): GroupData {
    const key = groupKey(unitId, groupNumber);
    const first = activities.find((a) => MEETING_TYPES.has(a.type));

    const info: GroupInfo = {
        courseId: first?.course_id ?? fallback?.course_id ?? "",
        course: langText(first?.course_name ?? fallback?.course_name),
        type: first?.classtype_id ?? fallback?.class_type_id ?? "",
        typeName: langText(first?.classtype_name ?? fallback?.class_type),
        group: groupNumber,
        url: first?.classgroup_profile_url ?? fallback?.group_url ?? null,
    };

    const buildings: Record<string, BuildingInfo> = {};
    const seen = new Set<string>();
    const meetings: MeetingTuple[] = [];

    for (const a of activities) {
        if (!MEETING_TYPES.has(a.type)) continue;
        // "classgroup" rows with an irregular frequency are USOS guesses, not meetings.
        if (a.type === "classgroup" && a.frequency && a.frequency !== "weekly") continue;
        const start = parseUsosDateTime(a.start_time);
        const end = parseUsosDateTime(a.end_time);
        if (!start || !end) continue;
        const endMin = end.date === start.date ? end.minutes : 24 * 60;
        if (endMin <= start.minutes) continue;

        const dedupe = `${start.date}|${start.minutes}|${endMin}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);

        const building = a.building_id?.trim() || null;
        if (building && !buildings[building]) {
            buildings[building] = {
                label: buildingLabel(inst, building),
                name: langText(a.building_name),
            };
        }

        meetings.push([
            key,
            start.date,
            start.minutes,
            endMin,
            a.room_number?.trim() || null,
            building,
            (a.lecturer_ids ?? []).map(Number).filter(Number.isFinite),
            typeof a.sm_id === "number" ? a.sm_id : null,
        ]);
    }

    meetings.sort((x, y) => (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : x[2] - y[2]));
    return { key, info, meetings, buildings };
}

export type Person = [first: string, last: string, title: string];

export function normalizePerson(raw: RawUser): Person {
    const before = raw.titles?.before?.trim() ?? "";
    const after = raw.titles?.after?.trim() ?? "";
    return [
        raw.first_name?.trim() ?? "",
        raw.last_name?.trim() ?? "",
        [before, after].filter(Boolean).join(" "),
    ];
}
