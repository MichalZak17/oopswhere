import { describe, expect, it } from "vitest";
import { baseString, hmacSha1Base64, pct, sign } from "./sign";

describe("pct (RFC 3986)", () => {
    it("encodes reserved characters USOS uses in ids", () => {
        expect(pct("IIN-N1-5-XXZ>0AGZ-LB")).toBe("IIN-N1-5-XXZ%3E0AGZ-LB");
        expect(pct("(5400,2)|(17879,321)")).toBe("%285400%2C2%29%7C%2817879%2C321%29");
        expect(pct("a b!*'")).toBe("a%20b%21%2A%27");
        expect(pct("☃")).toBe("%E2%98%83");
        expect(pct("-._~")).toBe("-._~");
    });
});

describe("OAuth 1.0a HMAC-SHA1 signatures", () => {
    it("matches OAuth Core 1.0 Appendix A.5", async () => {
        const { oauthParams } = await sign(
            {
                method: "GET",
                url: "http://photos.example.net/photos?file=vacation.jpg&size=original",
                nonce: "kllo9940pd9333jh",
                timestamp: "1191242096",
            },
            {
                consumerKey: "dpf43f3p2l4k3l03",
                consumerSecret: "kd94hf93k423kf44",
                token: "nnch734d00sl2jdk",
                tokenSecret: "pfkkdhi9sl3r4s00",
            },
        );
        expect(oauthParams.oauth_signature).toBe("tR3+Ty81lMeYAr/Fid0kMTYa/WM=");
    });

    it("matches RFC 5849 §1.2 temporary credentials request", async () => {
        const { oauthParams } = await sign(
            {
                method: "POST",
                url: "https://photos.example.net/initiate",
                oauth: { oauth_callback: "http://printer.example.com/ready" },
                nonce: "wIjqoS",
                timestamp: "137131200",
                version: false,
            },
            { consumerKey: "dpf43f3p2l4k3l03", consumerSecret: "kd94hf93k423kf44" },
        );
        expect(oauthParams.oauth_signature).toBe("74KNZJeDHnMBp0EMJ9ZHt/XKycU=");
    });

    it("matches RFC 5849 §1.2 token request", async () => {
        const { oauthParams } = await sign(
            {
                method: "POST",
                url: "https://photos.example.net/token",
                oauth: { oauth_verifier: "hfdp7dh39dks9884" },
                nonce: "walatlh",
                timestamp: "137131201",
                version: false,
            },
            {
                consumerKey: "dpf43f3p2l4k3l03",
                consumerSecret: "kd94hf93k423kf44",
                token: "hh5s93j4hdidpola",
                tokenSecret: "hdhd0244k9j7ao03",
            },
        );
        expect(oauthParams.oauth_signature).toBe("gKgrFCywp7rO0OXSjdot/IHF7IU=");
    });

    it("matches RFC 5849 §1.2 resource request", async () => {
        const { oauthParams } = await sign(
            {
                method: "GET",
                url: "http://photos.example.net/photos?file=vacation.jpg&size=original",
                nonce: "chapoH",
                timestamp: "137131202",
                version: false,
            },
            {
                consumerKey: "dpf43f3p2l4k3l03",
                consumerSecret: "kd94hf93k423kf44",
                token: "nnch734d00sl2jdk",
                tokenSecret: "pfkkdhi9sl3r4s00",
            },
        );
        expect(oauthParams.oauth_signature).toBe("MdpQcU8iPSUjWoN/UDMsK2sui9I=");
    });

    it("builds the RFC 5849 §3.4.1.1 base string", () => {
        const url = new URL("http://example.com/request?b5=%3D%253D&a3=a&c%40=&a2=r%20b");
        const pairs: [string, string][] = [
            ...Array.from(url.searchParams.entries()),
            ["c2", ""],
            ["a3", "2 q"],
            ["oauth_consumer_key", "9djdj82h48djs9d2"],
            ["oauth_token", "kkk9d7dh3k39sjv7"],
            ["oauth_signature_method", "HMAC-SHA1"],
            ["oauth_timestamp", "137131201"],
            ["oauth_nonce", "7d8f3e4a"],
        ];
        expect(baseString("POST", url, pairs)).toBe(
            "POST&http%3A%2F%2Fexample.com%2Frequest&a2%3Dr%2520b%26a3%3D2%2520q%26a3%3Da%26b5%3D%253D%25253D%26c%2540%3D%26c2%3D%26oauth_consumer_key%3D9djdj82h48djs9d2%26oauth_nonce%3D7d8f3e4a%26oauth_signature_method%3DHMAC-SHA1%26oauth_timestamp%3D137131201%26oauth_token%3Dkkk9d7dh3k39sjv7",
        );
    });

    it("produces an Authorization header with every oauth param", async () => {
        const { authorization } = await sign(
            {
                method: "POST",
                url: "https://usosapi.example/services/oauth/request_token",
                params: { scopes: "studies" },
                oauth: { oauth_callback: "http://localhost:4321/auth/zut/callback" },
            },
            { consumerKey: "key", consumerSecret: "secret" },
        );
        expect(authorization).toMatch(/^OAuth /);
        for (const k of [
            "oauth_consumer_key",
            "oauth_nonce",
            "oauth_signature",
            "oauth_callback",
            "oauth_timestamp",
        ]) {
            expect(authorization).toContain(`${k}="`);
        }
        expect(authorization).not.toContain("scopes");
    });

    it("HMAC-SHA1 known answer", async () => {
        expect(await hmacSha1Base64("key", "The quick brown fox jumps over the lazy dog")).toBe(
            "3nybhbi3iqa8ino29wqQcBydtNk=",
        );
    });
});
