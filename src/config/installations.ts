/**
 * USOS installations oopswhere knows about. Adding a university is a data change:
 * add an entry here, register a consumer key at <apiBaseUrl>/developers/ and set
 * USOS_<ID>_CONSUMER_KEY / USOS_<ID>_CONSUMER_SECRET. See docs/CONTRIBUTING.md.
 */
import type { LangText } from "@/lib/timetable/types";

export interface Installation {
    /** Lowercase id used in URLs, cookies and env var names. */
    id: string;
    shortName: string;
    name: LangText;
    apiBaseUrl: string;
    usoswebUrl: string;
    timeZone: string;
    /** OAuth scopes requested at login. */
    scopes: string[];
    /**
     * Timetable cache policy, seconds: served as-is while fresh, served and refreshed in
     * the background until swr, and kept as an outage fallback until maxStale.
     */
    tt: { freshSec: number; swrSec: number; maxStaleSec: number };
    /** Overrides for the short building label shown on cards. */
    buildingAliases?: Record<string, string>;
}

export const installations: Record<string, Installation> = {
    zut: {
        id: "zut",
        shortName: "ZUT",
        name: {
            pl: "Zachodniopomorski Uniwersytet Technologiczny w Szczecinie",
            en: "West Pomeranian University of Technology in Szczecin",
        },
        apiBaseUrl: "https://usosapi.zut.edu.pl/",
        usoswebUrl: "https://usosweb.zut.edu.pl/",
        timeZone: "Europe/Warsaw",
        scopes: ["studies"],
        tt: { freshSec: 30 * 60, swrSec: 6 * 60 * 60, maxStaleSec: 14 * 24 * 60 * 60 },
    },
};

export const DEFAULT_INSTALLATION = "zut";

export function getInstallation(id: string | undefined): Installation | null {
    if (!id) return null;
    return Object.hasOwn(installations, id) ? installations[id] : null;
}

/** "WI_WI1" → "WI1"; aliases win. */
export function buildingLabel(inst: Installation, buildingId: string): string {
    return inst.buildingAliases?.[buildingId] ?? buildingId.split("_").pop() ?? buildingId;
}
