/**
 * One row per class group the student attends, with who teaches it. Pure: built from the same
 * payload the calendar uses, so it costs no extra USOS calls.
 */
import { pick } from "@/i18n/pick";
import type { GroupKey, Lang, TimetablePayload } from "./types";

export interface SubjectLecturer {
    id: string;
    /** "dr Jarosław Woźniak": titles before the name, no titles after it. */
    name: string;
}

export interface SubjectRow {
    key: GroupKey;
    course: string;
    /** USOS class-type code: WK, LB, CW… */
    type: string;
    /** USOS's own name for the type, for codes the dictionary doesn't know. */
    typeName: string;
    group: number;
    lecturers: SubjectLecturer[];
}

/** Lectures first, then the practical forms, the way a printed syllabus lists them. */
const TYPE_ORDER = ["WK", "CW", "KN", "LB", "PR", "LK", "SM", "SD", "PD", "WR", "ZT", "PP", "WF"];

function typeRank(type: string): number {
    const i = TYPE_ORDER.indexOf(type);
    return i === -1 ? TYPE_ORDER.length : i;
}

/**
 * "dr Jarosław Woźniak". `Person` joins the titles before and after the name, so a trailing
 * "prof. ZUT" (a post-nominal, always an acronym) is dropped rather than put in front of it.
 */
function displayName([first, last, titles]: [string, string, string]): string {
    const before = titles.replace(/\s*\bprof\.\s+\p{Lu}{2,}$/u, "");
    return [before, first, last].filter(Boolean).join(" ");
}

export function buildSubjects(payload: TimetablePayload, lang: Lang): SubjectRow[] {
    // Lecturer ids per group, most meetings first: whoever teaches most is the one to list first.
    const counts = new Map<GroupKey, Map<number, number>>();
    for (const [key, , , , , , lecturerIds] of payload.meetings) {
        let perGroup = counts.get(key);
        if (!perGroup) counts.set(key, (perGroup = new Map()));
        for (const id of lecturerIds) perGroup.set(id, (perGroup.get(id) ?? 0) + 1);
    }

    const rows = (Object.keys(payload.groups) as GroupKey[]).map((key): SubjectRow => {
        const info = payload.groups[key];
        const lecturers = [...(counts.get(key) ?? [])]
            .sort((a, b) => b[1] - a[1] || a[0] - b[0])
            .flatMap(([id]): SubjectLecturer[] => {
                const person = payload.people[String(id)];
                return person ? [{ id: String(id), name: displayName(person) }] : [];
            });
        return {
            key,
            course: pick(info.course, lang) || info.courseId,
            type: info.type,
            typeName: pick(info.typeName, lang),
            group: info.group,
            lecturers,
        };
    });

    const collator = new Intl.Collator(lang === "pl" ? "pl" : "en");
    return rows.sort(
        (a, b) =>
            collator.compare(a.course, b.course) ||
            typeRank(a.type) - typeRank(b.type) ||
            a.group - b.group,
    );
}
