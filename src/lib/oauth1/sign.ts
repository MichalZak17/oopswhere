/**
 * OAuth 1.0a (RFC 5849) request signing with HMAC-SHA1 on Web Crypto.
 * No dependencies, so it runs the same on Node, Vercel functions and edge runtimes.
 */

/** RFC 3986 percent-encoding, as required by RFC 5849 §3.6 (never "+" for spaces). */
export function pct(value: string): string {
    return encodeURIComponent(value).replace(
        /[!'()*]/g,
        (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
    );
}

export type Pair = [string, string];

/** Base string URI: scheme and host lowercased, default ports and query dropped (§3.4.1.2). */
export function baseUri(url: URL): string {
    return `${url.protocol.toLowerCase()}//${url.host.toLowerCase()}${url.pathname}`;
}

/** Signature base string (§3.4.1). `pairs` must already include query, body and oauth_* params. */
export function baseString(method: string, url: URL, pairs: Pair[]): string {
    const normalized = pairs
        .map(([k, v]) => [pct(k), pct(v)] as const)
        .sort(([ak, av], [bk, bv]) => (ak < bk ? -1 : ak > bk ? 1 : av < bv ? -1 : av > bv ? 1 : 0))
        .map(([k, v]) => `${k}=${v}`)
        .join("&");
    return `${method.toUpperCase()}&${pct(baseUri(url))}&${pct(normalized)}`;
}

const encoder = new TextEncoder();

export async function hmacSha1Base64(key: string, data: string): Promise<string> {
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        encoder.encode(key),
        { name: "HMAC", hash: "SHA-1" },
        false,
        ["sign"],
    );
    const sig = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data)));
    let bin = "";
    for (const byte of sig) bin += String.fromCharCode(byte);
    return btoa(bin);
}

export interface Credentials {
    consumerKey: string;
    consumerSecret: string;
    token?: string;
    tokenSecret?: string;
}

export interface SignOptions {
    method: string;
    url: string | URL;
    /** Non-oauth request params that travel in the query or a form body. */
    params?: Record<string, string>;
    /** Extra protocol params such as oauth_callback or oauth_verifier. */
    oauth?: Record<string, string>;
    /** Fixed values for tests. */
    nonce?: string;
    timestamp?: string;
    version?: boolean;
}

export interface Signed {
    /** All oauth_* params including oauth_signature. */
    oauthParams: Record<string, string>;
    baseString: string;
    /** Ready-to-send `Authorization` header value. */
    authorization: string;
}

export function makeNonce(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sign(opts: SignOptions, creds: Credentials): Promise<Signed> {
    const url = new URL(opts.url);
    const oauthParams: Record<string, string> = {
        oauth_consumer_key: creds.consumerKey,
        oauth_nonce: opts.nonce ?? makeNonce(),
        oauth_signature_method: "HMAC-SHA1",
        oauth_timestamp: opts.timestamp ?? Math.floor(Date.now() / 1000).toString(),
        ...(opts.version === false ? {} : { oauth_version: "1.0" }),
        ...(creds.token ? { oauth_token: creds.token } : {}),
        ...opts.oauth,
    };

    const pairs: Pair[] = [
        ...Array.from(url.searchParams.entries()),
        ...Object.entries(opts.params ?? {}),
        ...Object.entries(oauthParams),
    ];
    const base = baseString(opts.method, url, pairs);
    const key = `${pct(creds.consumerSecret)}&${pct(creds.tokenSecret ?? "")}`;
    oauthParams.oauth_signature = await hmacSha1Base64(key, base);

    const authorization =
        "OAuth " +
        Object.entries(oauthParams)
            .map(([k, v]) => `${pct(k)}="${pct(v)}"`)
            .join(", ");

    return { oauthParams, baseString: base, authorization };
}

/** Form-encode with RFC 3986 rules (URLSearchParams would turn spaces into "+"). */
export function formEncode(params: Record<string, string>): string {
    return Object.entries(params)
        .map(([k, v]) => `${pct(k)}=${pct(v)}`)
        .join("&");
}
