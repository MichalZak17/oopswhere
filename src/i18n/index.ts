import type { Lang } from "@/lib/timetable/types";
import enJson from "./locales/en.json";
import plJson from "./locales/pl.json";

/** `locales/pl.json` is the source of truth; every other locale must match its shape. */
export type Dict = Omit<typeof plJson, "types"> & { types: Record<string, string> };
export type { Lang };
const pl: Dict = plJson;
const en: Dict = enJson;
export const LANGS: Lang[] = ["pl", "en"];
const dicts: Record<Lang, Dict> = { pl, en };

export function asLang(value: unknown): Lang {
    return value === "en" ? "en" : "pl";
}

export function t(lang: Lang): Dict {
    return dicts[lang];
}

/** Prefixes a path for the given language: "/" → "/en/". */
export function localePath(lang: Lang, path = "/"): string {
    if (lang === "pl") return path;
    return path === "/" ? "/en/" : `/en${path}`;
}

export { pick } from "./pick";
