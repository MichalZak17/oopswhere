/**
 * Refreshes tests/fixtures/zut from the public USOS API (anonymous GETs only — no keys,
 * no user data). Run: npm run fixtures
 */
import { mkdir, writeFile } from "node:fs/promises";
import { installations } from "../src/config/installations";
import { DEMO_GROUPS } from "../src/config/demo";
import { classgroupDates, groupInfo, termsBetween } from "../src/lib/usos/api";
import type { ResolvedInstallation } from "../src/lib/env";

const inst: ResolvedInstallation = { ...installations.zut, consumer: null };
const dir = new URL("../tests/fixtures/zut/", import.meta.url);

async function save(name: string, data: unknown) {
    const file = new URL(name, dir);
    await mkdir(new URL(".", file), { recursive: true });
    await writeFile(file, JSON.stringify(data, null, 2) + "\n");
    console.log("✓", name);
}

for (const [unit, group] of DEMO_GROUPS.zut) {
    await save(`classgroup_dates2/${unit}-${group}.json`, await classgroupDates(inst, unit, group));
    await save(`groups_group/${unit}-${group}.json`, await groupInfo(inst, unit, group));
}
await save("terms_search_2026-10-01.json", await termsBetween(inst, "2026-10-01", "2026-10-01"));
