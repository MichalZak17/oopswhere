import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mock, mockState, signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
    await mock(page, { deny: false, ttDown: false });
});

test("landing explains the privacy model and offers sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Co dalej?");
    await expect(
        page.getByText(
            "Hasło wpisujesz tylko na stronie uczelni. Nigdy go nie widzę ani nie zapisuję.",
        ),
    ).toBeVisible();
    await expect(
        page.locator(".hero-actions").getByRole("link", { name: "Zobacz plan demo" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "WT 13" }).click();
    await expect(page.getByText("Wtorek, 13 października")).toBeVisible();
    await expect(page.getByRole("button", { name: "WT 13" })).toHaveAttribute(
        "aria-pressed",
        "true",
    );
});

test("sign in once → calendar; token revoked; cookie is HttpOnly and holds no token", async ({
    page,
    context,
}) => {
    const before = await mockState(page);
    await signIn(page);
    await page.goto("/?week=2026-10-05");

    await expect(page.locator(".range")).toHaveText("10–11 października");
    await expect(page.getByRole("button", { name: /Ola/ })).toBeVisible();
    await expect(page.locator("[data-ev]")).toHaveCount(6);

    const after = await mockState(page);
    expect(after.revoked).toBe(before.revoked + 1);
    expect(after.signatureFailures).toBe(before.signatureFailures);

    const cookie = (await context.cookies()).find((c) => c.name.endsWith("ow_profile"))!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("Lax");
    expect(cookie.value.startsWith("v1.")).toBe(true);
    expect(cookie.value).not.toMatch(/at\d|ats\d|Ola|17879/);
    expect((await context.cookies()).some((c) => c.name.endsWith("ow_oauth"))).toBe(false);
});

test("groups from finished terms are ignored", async ({ page }) => {
    await signIn(page);
    const res = await page.request.get("/api/v1/timetable");
    const data = await res.json();
    expect(Object.keys(data.groups)).not.toContain("1-1");
    expect(data.gone).toEqual([]);
});

test("cancelling at the university login shows a calm message", async ({ page }) => {
    await mock(page, { deny: true });
    await signIn(page);
    await expect(page.getByRole("alert")).toContainText("Logowanie anulowane");
});

test("a forged callback is rejected", async ({ page }) => {
    await page.goto("/auth/zut/callback?oauth_token=rt999&oauth_verifier=v-rt999");
    await expect(page).toHaveURL(/auth=expired/);
});

test("cross-site login POST is blocked (CSRF)", async ({ request }) => {
    const res = await request.post("/auth/zut/login", {
        headers: { Origin: "https://evil.example" },
        form: { returnTo: "/" },
        maxRedirects: 0,
    });
    expect(res.status()).toBe(403);
});

test("the account menu says who, how many groups and which language", async ({ page }) => {
    await signIn(page);
    await page.getByRole("button", { name: /Ola/ }).click();
    const menu = page.locator("#account-menu");
    await expect(menu).toContainText("Ola");
    await expect(menu).toContainText(/6 grup · stan na \d+ \p{L}+ \d{4}/u);
    const language = menu.getByRole("group", { name: "Język" });
    await expect(language.locator("[aria-current]")).toHaveText("PL");
    await expect(language.getByRole("link", { name: "English" })).toBeVisible();
    // Let the open transition finish, or axe measures half-faded text.
    await menu.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const results = await new AxeBuilder({ page }).include("#account-menu").analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test("sign out clears the cookie", async ({ page, context }) => {
    await signIn(page);
    await page.getByRole("button", { name: /Ola/ }).click();
    await page.getByRole("button", { name: "Wyloguj" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Co dalej?");
    expect((await context.cookies()).some((c) => c.name.endsWith("ow_profile"))).toBe(false);
});
