/**
 * Thin USOS API client: anonymous GETs, or OAuth-signed POSTs (Authorization header).
 * Never logs URLs, tokens or bodies.
 */
import type { ResolvedInstallation } from "@/lib/env";
import { formEncode, sign } from "@/lib/oauth1/sign";

export const USER_AGENT = "oopswhere/0.1 (+https://github.com/MichalZak17/oopswhere)";

export class UsosError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly kind: "not_found" | "auth" | "bad_request" | "upstream" | "timeout" | "network",
    ) {
        super(message);
        this.name = "UsosError";
    }
}

export interface Token {
    key: string;
    secret: string;
}

export interface CallOptions {
    params?: Record<string, string | number | boolean | undefined>;
    /** Sign with the consumer (and token, if given). Anonymous when omitted. */
    signed?: boolean;
    token?: Token;
    timeoutMs?: number;
    /** Response format: JSON for regular methods, form-encoded text for OAuth endpoints. */
    as?: "json" | "form";
}

function stringParams(params: CallOptions["params"]): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined) out[k] = String(v);
    return out;
}

export async function usosCall<T>(
    inst: ResolvedInstallation,
    method: string,
    opts: CallOptions = {},
): Promise<T> {
    const url = new URL(`services/${method}`, inst.apiBaseUrl);
    const params = stringParams(opts.params);
    const headers: Record<string, string> = {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
    };
    let init: RequestInit;

    if (opts.signed || opts.token) {
        if (!inst.consumer) throw new UsosError("No consumer key configured", 500, "auth");
        // Protocol params (oauth_callback, oauth_verifier) travel in the Authorization header.
        const oauth: Record<string, string> = {};
        for (const k of Object.keys(params)) {
            if (k.startsWith("oauth_")) {
                oauth[k] = params[k];
                delete params[k];
            }
        }
        const { authorization } = await sign(
            { method: "POST", url, params, oauth },
            {
                consumerKey: inst.consumer.key,
                consumerSecret: inst.consumer.secret,
                token: opts.token?.key,
                tokenSecret: opts.token?.secret,
            },
        );
        headers.Authorization = authorization;
        headers["Content-Type"] = "application/x-www-form-urlencoded";
        init = { method: "POST", headers, body: formEncode(params) };
    } else {
        for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
        init = { method: "GET", headers };
    }

    let res: Response;
    try {
        res = await fetch(url, { ...init, signal: AbortSignal.timeout(opts.timeoutMs ?? 6000) });
    } catch (err) {
        const timeout =
            err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
        throw new UsosError(
            timeout ? `USOS ${method} timed out` : `USOS ${method} unreachable`,
            0,
            timeout ? "timeout" : "network",
        );
    }

    const text = await res.text();
    if (!res.ok) {
        let message = `USOS ${method} failed (${res.status})`;
        try {
            const body = JSON.parse(text) as { message?: string };
            if (body.message) message = `USOS ${method}: ${body.message}`;
        } catch {
            // not JSON
        }
        const kind =
            res.status === 401 || res.status === 403
                ? "auth"
                : res.status === 400 && /do not exist|does not exist/i.test(message)
                  ? "not_found"
                  : res.status === 400 || res.status === 404
                    ? "bad_request"
                    : "upstream";
        throw new UsosError(message, res.status, kind);
    }

    if (opts.as === "form") return Object.fromEntries(new URLSearchParams(text)) as T;
    return JSON.parse(text) as T;
}
