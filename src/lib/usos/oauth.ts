/** The three-legged USOS OAuth 1.0a dance. Tokens never leave the server. */
import type { ResolvedInstallation } from "@/lib/env";
import { usosCall, UsosError, type Token } from "./client";

export async function requestToken(inst: ResolvedInstallation, callback: string): Promise<Token> {
    if (!inst.consumer) throw new UsosError("No consumer key configured", 500, "auth");
    // oauth_callback is a protocol param; scopes is a USOS-specific request param.
    const res = await usosCall<Record<string, string>>(inst, "oauth/request_token", {
        params: { scopes: inst.scopes.join("|"), oauth_callback: callback },
        signed: true,
        as: "form",
    });
    if (!res.oauth_token || !res.oauth_token_secret || res.oauth_callback_confirmed !== "true") {
        throw new UsosError("Unexpected request_token response", 502, "upstream");
    }
    return { key: res.oauth_token, secret: res.oauth_token_secret };
}

export function authorizeUrl(inst: ResolvedInstallation, requestTokenKey: string): string {
    const url = new URL("services/oauth/authorize", inst.apiBaseUrl);
    url.searchParams.set("oauth_token", requestTokenKey);
    url.searchParams.set("interactivity", "minimal");
    return url.toString();
}

export async function accessToken(
    inst: ResolvedInstallation,
    request: Token,
    verifier: string,
): Promise<Token> {
    const res = await usosCall<Record<string, string>>(inst, "oauth/access_token", {
        params: { oauth_verifier: verifier },
        token: request,
        as: "form",
    });
    if (!res.oauth_token || !res.oauth_token_secret) {
        throw new UsosError("Unexpected access_token response", 502, "upstream");
    }
    return { key: res.oauth_token, secret: res.oauth_token_secret };
}

/** Best effort: we never keep the token, but we also don't leave it alive. */
export async function revokeToken(inst: ResolvedInstallation, token: Token): Promise<void> {
    try {
        await usosCall(inst, "oauth/revoke_token", { token, timeoutMs: 4000 });
    } catch {
        // It expires on its own within two hours anyway.
    }
}
