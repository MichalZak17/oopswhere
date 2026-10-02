import { defineConfig, devices } from "@playwright/test";

const APP_PORT = 4600;
const MOCK_PORT = 4500;
const MOCK = `http://127.0.0.1:${MOCK_PORT}/`;

// The app is built and run exactly like production (Node adapter), pointed at the mock USOS.
const appEnv = {
    HOST: "127.0.0.1",
    PORT: String(APP_PORT),
    SESSION_SECRET: "e2e-only-secret-0123456789abcdefghijklmnopq",
    SITE_URL: `http://127.0.0.1:${APP_PORT}`,
    USOS_ZUT_CONSUMER_KEY: "e2e-key",
    USOS_ZUT_CONSUMER_SECRET: "e2e-secret",
    USOS_ZUT_BASE_URL: MOCK,
    ENABLE_DEMO: "true",
};

export default defineConfig({
    testDir: "tests/e2e",
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? "github" : "list",
    use: {
        baseURL: `http://127.0.0.1:${APP_PORT}`,
        // Locally use the installed Chrome; CI installs Playwright's Chromium.
        channel: process.env.CI ? undefined : "chrome",
        trace: "retain-on-failure",
    },
    projects: [
        {
            name: "desktop",
            use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } },
            grepInvert: /@mobile/,
        },
        { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
    ],
    webServer: [
        {
            command: "npx tsx tests/mock-usos/server.ts",
            url: `${MOCK}__state`,
            env: { MOCK_USOS_PORT: String(MOCK_PORT) },
            reuseExistingServer: false,
        },
        {
            command: "npx astro build && node server.mjs",
            url: `http://127.0.0.1:${APP_PORT}/api/health`,
            env: appEnv,
            timeout: 180_000,
            reuseExistingServer: false,
        },
    ],
});
