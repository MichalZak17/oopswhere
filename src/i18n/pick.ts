import type { Lang, LangText } from "@/lib/timetable/types";

/** Picks the right language from a USOS LangDict, falling back to Polish. */
export function pick(text: LangText | null | undefined, lang: Lang): string {
    if (!text) return "";
    return (lang === "en" && text.en) || text.pl || text.en || "";
}
