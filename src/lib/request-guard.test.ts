import { describe, expect, it } from "vitest";
import { canonicalRedirect, isCrossSiteWrite } from "./request-guard";

const SITE = "https://oopswhere.com";
// What the app actually sees behind Cloudflare → Traefik: plain http.
const seen = (path: string, host = "oopswhere.com") => new URL(`http://${host}${path}`);
const req = (method: string, origin?: string) =>
    new Request("http://oopswhere.com/auth/zut/login", {
        method,
        headers: origin ? { origin } : {},
    });

describe("isCrossSiteWrite", () => {
    it("accepts a POST from the public https origin although the server sees http", () => {
        expect(isCrossSiteWrite(req("POST", SITE), SITE)).toBe(false);
    });

    it("rejects POSTs from other origins, other hosts and without Origin", () => {
        expect(isCrossSiteWrite(req("POST", "https://evil.example"), SITE)).toBe(true);
        expect(isCrossSiteWrite(req("POST", "https://www.oopswhere.com"), SITE)).toBe(true);
        expect(isCrossSiteWrite(req("POST", "http://oopswhere.com"), SITE)).toBe(true);
        expect(isCrossSiteWrite(req("POST"), SITE)).toBe(true);
    });

    it("ignores safe methods", () => {
        expect(isCrossSiteWrite(req("GET", "https://evil.example"), SITE)).toBe(false);
        expect(isCrossSiteWrite(req("HEAD"), SITE)).toBe(false);
    });
});

describe("canonicalRedirect", () => {
    const get = new Request("http://x/");

    it("leaves the canonical host alone, whatever protocol the proxy used", () => {
        expect(canonicalRedirect(get, seen("/en/?week=2026-10-05"), SITE)).toBeNull();
    });

    it("sends other hosts to SITE_URL, keeping path and query", () => {
        expect(
            canonicalRedirect(get, seen("/en/?week=2026-10-05", "www.oopswhere.com"), SITE),
        ).toBe("https://oopswhere.com/en/?week=2026-10-05");
    });

    it("never redirects the container health check or non-GET requests", () => {
        expect(canonicalRedirect(get, seen("/api/health", "localhost:4321"), SITE)).toBeNull();
        const post = new Request("http://x/", { method: "POST" });
        expect(
            canonicalRedirect(post, seen("/auth/zut/login", "www.oopswhere.com"), SITE),
        ).toBeNull();
    });

    it("is a no-op when the public origin is the request origin (dev, e2e)", () => {
        const url = new URL("http://127.0.0.1:4600/demo");
        expect(canonicalRedirect(get, url, url.origin)).toBeNull();
    });
});
