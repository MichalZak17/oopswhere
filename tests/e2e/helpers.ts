import type { Page } from "@playwright/test";

export const MOCK = "http://127.0.0.1:4500";

export async function mock(page: Page, patch: Record<string, unknown>) {
    await page.request.post(`${MOCK}/__control`, { data: patch });
}

export async function mockState(
    page: Page,
): Promise<{ revoked: number; signatureFailures: number }> {
    return (await page.request.get(`${MOCK}/__state`)).json();
}

/** Signs in through the (mock) university login and lands on the calendar. */
export async function signIn(page: Page, path = "/") {
    await page.goto(path);
    await page
        .getByRole("button", { name: /Zaloguj przez USOS|Sign in with USOS/ })
        .first()
        .click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth/"));
}
