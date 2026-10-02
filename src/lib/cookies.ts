/** Cookie names and flags. Prefixed (__Host-/__Secure-) whenever we're on HTTPS. */
import type { AstroCookies } from "astro";
import { isHttps, sessionSecrets } from "@/lib/env";
import { seal, unseal } from "@/lib/crypto/seal";
import { isProfile, type Profile } from "@/lib/profile";

const PROFILE = "ow_profile";
const OAUTH = "ow_oauth";
export const LANG_COOKIE = "ow_lang";
export { THEME_COOKIE } from "./theme";

const PROFILE_MAX_AGE = 400 * 24 * 60 * 60; // browsers cap cookies at 400 days
const OAUTH_MAX_AGE = 15 * 60;

const isSecure = isHttps;
const profileName = (url: URL) => (isSecure(url) ? `__Host-${PROFILE}` : PROFILE);
const oauthName = (url: URL) => (isSecure(url) ? `__Secure-${OAUTH}` : OAUTH);

export async function readProfile(cookies: AstroCookies, url: URL): Promise<Profile | null> {
    const raw = cookies.get(profileName(url))?.value;
    if (!raw) return null;
    try {
        const value = await unseal<unknown>(raw, sessionSecrets(), "profile");
        return isProfile(value) ? value : null;
    } catch {
        return null;
    }
}

export async function writeProfile(
    cookies: AstroCookies,
    url: URL,
    profile: Profile,
): Promise<void> {
    cookies.set(profileName(url), await seal(profile, sessionSecrets()[0], "profile"), {
        path: "/",
        httpOnly: true,
        secure: isSecure(url),
        sameSite: "lax",
        maxAge: PROFILE_MAX_AGE,
    });
}

export function clearProfile(cookies: AstroCookies, url: URL): void {
    cookies.delete(profileName(url), {
        path: "/",
        secure: isSecure(url),
        httpOnly: true,
        sameSite: "lax",
    });
}

export interface OAuthState {
    /** Installation id. */
    i: string;
    /** Request token + secret. */
    k: string;
    s: string;
    /** Created at (unix ms). */
    t: number;
    /** Where to go afterwards (validated local path). */
    r: string;
}

export async function writeOAuthState(
    cookies: AstroCookies,
    url: URL,
    state: OAuthState,
): Promise<void> {
    cookies.set(oauthName(url), await seal(state, sessionSecrets()[0], "oauth"), {
        path: "/auth/",
        httpOnly: true,
        secure: isSecure(url),
        // Lax is required: USOS sends the user back with a cross-site top-level GET.
        sameSite: "lax",
        maxAge: OAUTH_MAX_AGE,
    });
}

/** Reads and immediately deletes the one-shot OAuth cookie. */
export async function takeOAuthState(cookies: AstroCookies, url: URL): Promise<OAuthState | null> {
    const raw = cookies.get(oauthName(url))?.value;
    cookies.delete(oauthName(url), {
        path: "/auth/",
        secure: isSecure(url),
        httpOnly: true,
        sameSite: "lax",
    });
    const state = await unseal<OAuthState>(raw, sessionSecrets(), "oauth").catch(() => null);
    if (!state || Date.now() - state.t > OAUTH_MAX_AGE * 1000) return null;
    return state;
}

export { safeReturnTo } from "./return-to";
