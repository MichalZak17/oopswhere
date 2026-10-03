import { expect, type Page } from "@playwright/test";

export const MOCK = "http://127.0.0.1:4500";

export async function mock(page: Page, patch: Record<string, unknown>) {
    await page.request.post(`${MOCK}/__control`, { data: patch });
}

export async function mockState(
    page: Page,
): Promise<{ revoked: number; signatureFailures: number }> {
    return (await page.request.get(`${MOCK}/__state`)).json();
}

/**
 * Waits for `?week=` to name `week`. The param is left out when the week on screen is the one
 * the page opens on anyway (the week of the next class), which depends on today's date.
 */
export async function expectWeekInUrl(page: Page, week: string) {
    await expect(page).toHaveURL((url) => [week, null].includes(url.searchParams.get("week")));
}

/** Signs in through the (mock) university login and lands on the calendar. */
export async function signIn(page: Page, path = "/") {
    await page.goto(path);
    await page
        .getByRole("button", { name: /Wejdź przez portal USOS|Enter through the USOS portal/ })
        .first()
        .click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth/"));
}
