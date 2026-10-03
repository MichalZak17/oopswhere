import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { expectWeekInUrl, mock } from "./helpers";

test.beforeEach(async ({ page }) => {
    await mock(page, { deny: false, ttDown: false });
});

test("the Saturday clash renders side by side and is flagged", async ({ page }) => {
    await page.goto("/demo?week=2026-10-05");
    const clashing = page.locator(".ev.conflict");
    await expect(clashing).toHaveCount(2);
    const [a, b] = await Promise.all([
        clashing.nth(0).boundingBox(),
        clashing.nth(1).boundingBox(),
    ]);
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(2);
    expect(Math.abs(a!.x - b!.x)).toBeGreaterThan(50);
    await expect(clashing.first()).toContainText("kolizja");
});

test("weekend students only see the days they have classes", async ({ page }) => {
    await page.goto("/demo?week=2026-10-05");
    await expect(page.locator(".day-head .dow")).toHaveText(["sobota", "niedziela"]);
    await page.getByRole("button", { name: "Cały tydzień" }).click();
    await expect(page.locator(".day-head")).toHaveCount(7);
});

test("week navigation via buttons, keys and the address bar", async ({ page }) => {
    await page.goto("/demo?week=2026-10-05");
    await page.getByRole("button", { name: "Następny tydzień" }).click();
    await expect(page).toHaveURL(/week=2026-10-12/);
    await page.keyboard.press("ArrowLeft");
    await expectWeekInUrl(page, "2026-10-05");
    await expect(page.locator(".range")).toHaveText("10–11 października");
});

test("an empty week offers a jump to the next classes", async ({ page }) => {
    await page.goto("/demo?week=2026-09-28");
    await expect(page.getByText("Brak zajęć")).toBeVisible();
    await page.getByRole("button", { name: /Przejdź/ }).click();
    await expectWeekInUrl(page, "2026-10-05");
    await expect(page.locator(".range")).toHaveText("10–11 października");
});

test("class details: open, read, close with Escape, focus returns", async ({ page }) => {
    await page.goto("/demo?week=2026-10-05");
    const card = page.locator("[data-ev]", { hasText: "Algorytmy 2" }).first();
    await card.click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("heading", { name: "Algorytmy 2" })).toBeVisible();
    await expect(sheet).toContainText("Sala 215 · WI1");
    await expect(sheet).toContainText("dr Jan Nowak-");
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(card).toBeFocused();
});

test("English version", async ({ page }) => {
    await page.goto("/lang/en?to=%2Fen%2Fdemo");
    await expect(page).toHaveURL(/\/en\/demo/);
    await page.goto("/en/demo?week=2026-10-05");
    await expect(page.locator(".range")).toHaveText(/^10\s?–\s?11 October$/);
    await expect(page.locator(".day-head .dow").first()).toHaveText("Saturday");
    await page.goto("/");
    await expect(page).toHaveURL(/\/en\/$/); // remembered choice
    await page.goto("/lang/pl?to=%2F");
});

test("USOS outage: the cached timetable keeps rendering", async ({ page }) => {
    await page.goto("/demo?week=2026-10-05"); // warm the cache
    await mock(page, { ttDown: true });
    await page.goto("/demo?week=2026-10-05");
    await expect(page.locator("[data-ev]")).toHaveCount(6);
    await mock(page, { ttDown: false });
});

test("personal pages are never stored in shared caches", async ({ request }) => {
    const res = await request.get("/demo");
    expect(res.headers()["cache-control"]).toBe("private, no-cache");
    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});

test("accessibility: landing and calendar have no serious axe violations", async ({ page }) => {
    for (const path of ["/", "/demo?week=2026-10-05"]) {
        await page.goto(path);
        await page.waitForTimeout(1000);
        const results = await new AxeBuilder({ page }).analyze();
        const serious = results.violations.filter(
            (v) => v.impact === "serious" || v.impact === "critical",
        );
        expect(
            serious.map((v) => `${v.id}: ${v.help}`),
            path,
        ).toEqual([]);
    }
});

test("mobile: one day at a time with a day switcher @mobile", async ({ page }) => {
    await page.goto("/demo?week=2026-10-05");
    const chips = page.getByRole("tab");
    await expect(chips).toHaveCount(2);
    await chips.nth(1).click();
    await expect(chips.nth(1)).toHaveAttribute("aria-selected", "true");
    await page.locator("[data-ev]", { hasText: "Język angielski 2" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    const box = await sheet.locator(".panel").boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
});
