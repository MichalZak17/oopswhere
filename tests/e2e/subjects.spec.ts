import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mock, signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
    await mock(page, { deny: false, ttDown: false });
});

test("the subjects page is for signed-in students only", async ({ page }) => {
    await page.goto("/subjects");
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/en/subjects");
    await expect(page).toHaveURL(/\/en\/$/);
});

test("subjects table: one row per group, lecturers link to their page, signature is blank", async ({
    page,
}) => {
    await signIn(page);
    await page.getByRole("button", { name: /Ola|Menu/ }).click();
    await page.getByRole("link", { name: "Przedmioty" }).click();
    await expect(page).toHaveURL(/\/subjects$/);
    await expect(page).toHaveTitle(/Twoje przedmioty/);

    const table = page.getByRole("table", { name: "Twoje przedmioty" });
    await expect(table.getByRole("columnheader")).toHaveText(["Przedmiot", "Prowadzący", "Podpis"]);

    const rows = table.locator("tbody tr");
    expect(await rows.count()).toBeGreaterThan(1);
    // Alphabetical, like a printed list.
    const names = await rows.locator("th").allInnerTexts();
    const first = names.map((n) => n.split(" – ")[0]!);
    expect(first).toEqual([...first].sort((a, b) => a.localeCompare(b, "pl")));

    const testing = rows.filter({ hasText: "Testowanie oprogramowania" });
    await expect(testing).toHaveCount(2);
    await expect(testing.first().locator("th")).toContainText(
        /Testowanie oprogramowania – \p{L}+/u,
    );
    const ewa = testing.first().getByRole("link", { name: "dr inż. Ewa Testerska" });
    await expect(ewa).toHaveAttribute("href", "/lecturer/1265207");

    for (const cell of await rows.locator("td.sign").all()) await expect(cell).toBeEmpty();
});

test("English subjects page", async ({ page }) => {
    await signIn(page, "/en/");
    await page.goto("/en/subjects");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your subjects");
    await expect(page.getByRole("table").getByRole("columnheader")).toHaveText([
        "Subject",
        "Lecturer",
        "Signature",
    ]);
    await expect(page.getByRole("link", { name: "dr inż. Ewa Testerska" }).first()).toHaveAttribute(
        "href",
        "/en/lecturer/1265207",
    );
});

test("the subjects page is never stored in shared caches", async ({ page }) => {
    await signIn(page);
    const res = await page.request.get("/subjects");
    expect(res.headers()["cache-control"]).toBe("private, no-cache");
});

test("accessibility: subjects page has no serious axe violations", async ({ page }) => {
    await signIn(page);
    await page.goto("/subjects");
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
});
