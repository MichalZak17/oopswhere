/**
 * A tiny fake USOS API for end-to-end tests. It serves the captured ZUT fixtures and
 * runs the OAuth 1.0a dance — verifying every signature with node:crypto, i.e. an
 * implementation independent from the app's Web Crypto signer.
 *
 * Control endpoints (test-only):
 *   POST /__control  {"deny":bool,"ttDown":bool}   change behaviour
 *   GET  /__state                                  { revoked, signatureFailures }
 */
import { createHmac } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const PORT = Number(process.env.MOCK_USOS_PORT ?? 4500);
const CONSUMER_KEY = "e2e-key";
const CONSUMER_SECRET = "e2e-secret";
const FIXTURES = new URL("../fixtures/zut/", import.meta.url);
const GROUPS: [number, number][] = [
    [17879, 321],
    [9297, 3],
    [5400, 2],
    [39536, 32],
    [12940, 321],
    [35564, 1],
];

const tokenSecrets = new Map<string, string>(); // request + access tokens
const callbacks = new Map<string, string>();
const state = { deny: false, ttDown: false, revoked: 0, signatureFailures: 0 };
let seq = 0;

const pct = (s: string) =>
    encodeURIComponent(s).replace(
        /[!'()*]/g,
        (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
    );

function parseAuthHeader(header: string | undefined): Record<string, string> {
    const out: Record<string, string> = {};
    if (!header?.startsWith("OAuth ")) return out;
    for (const m of header.slice(6).matchAll(/([\w-]+)="([^"]*)"/g))
        out[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
    return out;
}

function verify(
    req: IncomingMessage,
    url: URL,
    body: URLSearchParams,
): Record<string, string> | null {
    const oauth = parseAuthHeader(req.headers.authorization);
    if (oauth.oauth_consumer_key !== CONSUMER_KEY || oauth.oauth_signature_method !== "HMAC-SHA1")
        return null;
    const pairs: [string, string][] = [...url.searchParams, ...body];
    for (const [k, v] of Object.entries(oauth))
        if (k !== "oauth_signature" && k !== "realm") pairs.push([k, v]);
    const norm = pairs
        .map(([k, v]) => [pct(k), pct(v)])
        .sort(([a, x], [b, y]) => (a < b ? -1 : a > b ? 1 : x < y ? -1 : x > y ? 1 : 0))
        .map(([k, v]) => `${k}=${v}`)
        .join("&");
    const base = `${req.method}&${pct(`http://${req.headers.host}${url.pathname}`)}&${pct(norm)}`;
    const tokenSecret = oauth.oauth_token ? (tokenSecrets.get(oauth.oauth_token) ?? "") : "";
    const expected = createHmac("sha1", `${pct(CONSUMER_SECRET)}&${pct(tokenSecret)}`)
        .update(base)
        .digest("base64");
    if (expected !== oauth.oauth_signature) {
        state.signatureFailures++;
        return null;
    }
    return oauth;
}

function json(res: ServerResponse, status: number, data: unknown) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify(data));
}

function fixture(name: string): unknown | null {
    const file = new URL(name, FIXTURES);
    return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
}

async function readBody(req: IncomingMessage): Promise<string> {
    let data = "";
    for await (const chunk of req) data += chunk;
    return data;
}

createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const raw = await readBody(req);
    const isForm = (req.headers["content-type"] ?? "").includes(
        "application/x-www-form-urlencoded",
    );
    const body = new URLSearchParams(isForm ? raw : "");
    const path = url.pathname.replace(/^\/services\//, "");

    if (url.pathname === "/__control" && req.method === "POST") {
        Object.assign(state, JSON.parse(raw || "{}"));
        return json(res, 200, state);
    }
    if (url.pathname === "/__state") return json(res, 200, state);

    switch (path) {
        case "oauth/request_token": {
            const oauth = verify(req, url, body);
            if (!oauth || !oauth.oauth_callback)
                return json(res, 401, { message: "Invalid signature." });
            if (body.get("scopes") !== "studies") return json(res, 400, { message: "bad scopes" });
            const token = `rt${++seq}`;
            tokenSecrets.set(token, `rts${seq}`);
            callbacks.set(token, oauth.oauth_callback);
            res.writeHead(200, { "Content-Type": "text/plain" });
            return res.end(
                `oauth_token=${token}&oauth_token_secret=rts${seq}&oauth_callback_confirmed=true`,
            );
        }
        case "oauth/authorize": {
            // Stands in for the university login page: the user "logs in" instantly.
            const token = url.searchParams.get("oauth_token") ?? "";
            const callback = callbacks.get(token);
            if (!callback) return json(res, 400, { message: "unknown token" });
            const back = new URL(callback);
            back.searchParams.set("oauth_token", token);
            if (!state.deny) back.searchParams.set("oauth_verifier", "v-" + token);
            res.writeHead(302, { Location: back.toString() });
            return res.end();
        }
        case "oauth/access_token": {
            const oauth = verify(req, url, body);
            if (!oauth || oauth.oauth_verifier !== "v-" + oauth.oauth_token)
                return json(res, 401, { message: "bad verifier" });
            const token = `at${++seq}`;
            tokenSecrets.set(token, `ats${seq}`);
            res.writeHead(200, { "Content-Type": "text/plain" });
            return res.end(`oauth_token=${token}&oauth_token_secret=ats${seq}`);
        }
        case "oauth/revoke_token": {
            const oauth = verify(req, url, body);
            if (!oauth) return json(res, 401, { message: "Invalid signature." });
            state.revoked++;
            tokenSecrets.delete(oauth.oauth_token);
            return json(res, 200, { success: true });
        }
        case "groups/participant": {
            const oauth = verify(req, url, body);
            if (!oauth?.oauth_token?.startsWith("at"))
                return json(res, 401, { message: "token required" });
            if ((body.get("fields") ?? "").includes("participants"))
                return json(res, 400, { message: "not allowed in tests" });
            return json(res, 200, {
                groups: {
                    "2026/2027-Z": GROUPS.map(([u, g]) => ({
                        course_unit_id: u,
                        group_number: g,
                        term_id: "2026/2027-Z",
                    })),
                    "2025/2026-L": [{ course_unit_id: 1, group_number: 1, term_id: "2025/2026-L" }],
                },
                terms: [
                    {
                        id: "2026/2027-Z",
                        start_date: "2026-10-01",
                        end_date: "2027-02-28",
                        finish_date: "2027-02-28",
                    },
                    {
                        id: "2025/2026-L",
                        start_date: "2026-03-01",
                        end_date: "2026-09-30",
                        finish_date: "2026-09-30",
                    },
                ],
            });
        }
        case "users/user": {
            const oauth = verify(req, url, body);
            if (!oauth?.oauth_token) return json(res, 401, { message: "token required" });
            return json(res, 200, { first_name: "Ola" });
        }
        case "users/users": {
            if (!verify(req, url, body)) return json(res, 401, { message: "consumer required" });
            const ids = (body.get("user_ids") ?? "").split("|").filter(Boolean);
            return json(
                res,
                200,
                Object.fromEntries(
                    ids.map((id) => [
                        id,
                        {
                            id,
                            first_name: "Jan",
                            last_name: `Nowak-${id}`,
                            titles: { before: "dr", after: null },
                        },
                    ]),
                ),
            );
        }
        case "tt/classgroup_dates2": {
            if (state.ttDown) return json(res, 503, { message: "maintenance" });
            const data = fixture(
                `classgroup_dates2/${url.searchParams.get("unit_id")}-${url.searchParams.get("group_number")}.json`,
            );
            return data
                ? json(res, 200, data)
                : json(res, 400, { message: "Some of the referenced objects do not exist." });
        }
        case "groups/group": {
            const data = fixture(
                `groups_group/${url.searchParams.get("course_unit_id")}-${url.searchParams.get("group_number")}.json`,
            );
            return data
                ? json(res, 200, data)
                : json(res, 400, { message: "Some of the referenced objects do not exist." });
        }
        default:
            return json(res, 404, { message: `mock: no ${path}` });
    }
}).listen(PORT, "127.0.0.1", () => console.log(`mock USOS on http://127.0.0.1:${PORT}`));
