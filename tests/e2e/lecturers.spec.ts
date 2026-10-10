import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mock, signIn } from "./helpers";

// Mock staff (tests/mock-usos/server.ts): dr inż. Ewa Testerska (1265207) teaches the two
// "Testowanie oprogramowania" groups; 777 is a user who teaches nothing.
const EWA = "/lecturer/1265207";

test.beforeEach(async ({ page }) => {
    await mock(page, { deny: false, ttDown: false });
});

/** Islands render on the server first; wait until they're live before using the keyboard. */
async function hydrated(page: Page) {
    await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
}

async function openSearch(page: Page) {
    await hydrated(page);
    await page.getByRole("button", { name: "Szukaj prowadzącego" }).click();
    const dialog = page.getByRole("dialog", { name: "Szukaj prowadzącego" });
    await expect(dialog).toBeVisible();
    return dialog;
}

test("lecturer pages and search are for signed-in students only", async ({ page, request }) => {
    const api = await request.get("/api/v1/lecturers?q=ewa");
    expect(api.status()).toBe(401);
    expect((await request.get("/api/v1/lecturers/1265207")).status()).toBe(401);

    await page.goto(EWA);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Plany prowadzących są dla zalogowanych.",
    );
    await expect(page.getByRole("button", { name: "Szukaj prowadzącego" })).toHaveCount(0);

    // Signing in from a lecturer link comes straight back to it.
    await page
        .getByRole("button", { name: /Wejdź przez portal USOS/ })
        .first()
        .click();
    await page.waitForURL((url) => url.pathname === EWA);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("dr inż. Ewa Testerska");
});

test("find a lecturer by name and see their timetable", async ({ page }) => {
    await signIn(page);
    const dialog = await openSearch(page);
    const field = dialog.getByRole("combobox");
    await expect(field).toBeFocused();
    await expect(dialog).toContainText("Wpisz co najmniej 2 litery");

    await field.fill("ewa test");
    const option = dialog.getByRole("option", { name: /Ewa Testerska/ });
    await expect(option).toBeVisible();
    await expect(option).toContainText("Katedra Inżynierii Oprogramowania");
    await expect(option).toHaveAttribute("aria-selected", "true");
    await field.press("Enter");

    await page.waitForURL((url) => url.pathname === EWA);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("dr inż. Ewa Testerska");
    await expect(page.getByText("Katedra Inżynierii Oprogramowania")).toBeVisible();

    await page.goto(`${EWA}?week=2026-10-05`);
    await expect(page.locator(".range")).toHaveText("10–11 października");
    await expect(page).toHaveTitle(/^Ewa Testerska · /);
    const cards = page.locator("[data-ev]");
    await expect(cards.first()).toBeVisible();
    for (const text of await cards.allInnerTexts()) expect(text).toContain("Testowanie");
    // The group from a finished term is never loaded (it would show up as "gone").
    await expect(page.getByText("zniknęły z USOS")).toHaveCount(0);
    await expect(page.getByText("Wszystkie grupy, które prowadzi")).toBeVisible();
});

test("search: '/' opens it, unknown names say so, Escape closes", async ({ page }) => {
    await signIn(page);
    await hydrated(page);
    await page.keyboard.press("/");
    const dialog = page.getByRole("dialog", { name: "Szukaj prowadzącego" });
    await expect(dialog).toBeVisible();
    await page.keyboard.type("zzz");
    await expect(dialog).toContainText("Nikt taki tu nie uczy");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
});

test("a lecturer's name in the class sheet opens their timetable", async ({ page }) => {
    await signIn(page);
    await page.goto("/?week=2026-10-05");
    await page.locator("[data-ev]", { hasText: "Testowanie oprogramowania" }).first().click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("link", { name: "dr inż. Ewa Testerska" }).click();
    await page.waitForURL((url) => url.pathname === EWA);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("dr inż. Ewa Testerska");

    // On her own page her name is plain text, not a link back to it.
    await page.goto(`${EWA}?week=2026-10-05`);
    await page.locator("[data-ev]").first().click();
    await expect(page.getByRole("dialog").getByText("dr inż. Ewa Testerska")).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("link", { name: /Testerska/ })).toHaveCount(0);
});

test("only people who teach get a page", async ({ page }) => {
    await signIn(page);
    for (const path of ["/lecturer/777", "/lecturer/999999", "/lecturer/abc", "/lecturer/0123"]) {
        const res = await page.goto(path);
        expect(res?.status(), path).toBe(404);
    }
    const api = await page.request.get("/api/v1/lecturers/777");
    expect(api.status()).toBe(404);
});

test("lecturer timetable API mirrors the page and is never shared-cached", async ({ page }) => {
    await signIn(page);
    const res = await page.request.get("/api/v1/lecturers/1265207");
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toBe("private, no-cache");
    const body = await res.json();
    expect(Object.keys(body.groups).sort()).toEqual(["12940-321", "39536-32"]);
    expect(body.gone).toEqual([]);

    const search = await page.request.get("/api/v1/lecturers?q=marek");
    expect(search.headers()["cache-control"]).toBe("private, max-age=300");
    expect((await search.json()).items.map((l: { last: string }) => l.last)).toEqual(["Danecki"]);
});

test("English lecturer page", async ({ page }) => {
    await signIn(page, "/en/");
    await page.goto(`/en${EWA}?week=2026-10-05`);
    await expect(page.getByRole("link", { name: /Your timetable/ })).toBeVisible();
    await expect(page.getByText("Every group they teach this term")).toBeVisible();
});

test("accessibility: lecturer page and search have no serious axe violations", async ({ page }) => {
    await signIn(page);
    await page.goto(`${EWA}?week=2026-10-05`);
    await page.waitForTimeout(1000);
    const serious = (r: Awaited<ReturnType<AxeBuilder["analyze"]>>) =>
        r.violations
            .filter((v) => v.impact === "serious" || v.impact === "critical")
            .map((v) => `${v.id}: ${v.help}`);
    expect(serious(await new AxeBuilder({ page }).analyze()), "page").toEqual([]);

    const dialog = await openSearch(page);
    await dialog.getByRole("combobox").fill("ewa");
    await expect(dialog.getByRole("option")).toHaveCount(1);
    expect(serious(await new AxeBuilder({ page }).analyze()), "search").toEqual([]);
});

test("mobile: search from the header icon @mobile", async ({ page }) => {
    await signIn(page);
    const dialog = await openSearch(page);
    await dialog.getByRole("combobox").fill("marek");
    await dialog.getByRole("option", { name: /Marek Danecki/ }).click();
    await page.waitForURL((url) => url.pathname === "/lecturer/34016");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "dr hab. Marek Danecki, prof. ZUT",
    );
});
