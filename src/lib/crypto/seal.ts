/**
 * Authenticated encryption for cookies: AES-256-GCM with a per-purpose key derived
 * from the session secret via HKDF. The purpose is also bound as additional data,
 * so a sealed OAuth cookie can never be replayed as a profile cookie.
 *
 * Format: "v1." + base64url(iv[12] ‖ ciphertext ‖ tag[16])
 */
import { fromBase64Url, toBase64Url } from "./base64url";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const PREFIX = "v1.";
const keyCache = new Map<string, Promise<CryptoKey>>();

function deriveKey(secret: string, purpose: string): Promise<CryptoKey> {
    const cacheKey = `${purpose}\u0000${secret}`;
    let key = keyCache.get(cacheKey);
    if (!key) {
        key = crypto.subtle
            .importKey("raw", encoder.encode(secret), "HKDF", false, ["deriveKey"])
            .then((ikm) =>
                crypto.subtle.deriveKey(
                    {
                        name: "HKDF",
                        hash: "SHA-256",
                        salt: encoder.encode("oopswhere/seal/v1"),
                        info: encoder.encode(purpose),
                    },
                    ikm,
                    { name: "AES-GCM", length: 256 },
                    false,
                    ["encrypt", "decrypt"],
                ),
            );
        keyCache.set(cacheKey, key);
    }
    return key;
}

export async function seal(value: unknown, secret: string, purpose: string): Promise<string> {
    const key = await deriveKey(secret, purpose);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt(
            { name: "AES-GCM", iv, additionalData: encoder.encode(purpose) },
            key,
            encoder.encode(JSON.stringify(value)),
        ),
    );
    const out = new Uint8Array(iv.length + ciphertext.length);
    out.set(iv);
    out.set(ciphertext, iv.length);
    return PREFIX + toBase64Url(out);
}

/** Tries each secret in order (current first, then previous). Any failure → null. */
export async function unseal<T>(
    token: string | undefined | null,
    secrets: readonly string[],
    purpose: string,
): Promise<T | null> {
    if (!token || !token.startsWith(PREFIX)) return null;
    const bytes = fromBase64Url(token.slice(PREFIX.length));
    if (!bytes || bytes.length < 12 + 16) return null;
    const iv = bytes.slice(0, 12);
    const ciphertext = bytes.slice(12);
    for (const secret of secrets) {
        try {
            const key = await deriveKey(secret, purpose);
            const plain = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv, additionalData: encoder.encode(purpose) },
                key,
                ciphertext,
            );
            return JSON.parse(decoder.decode(plain)) as T;
        } catch {
            // wrong key or tampered — try the next secret
        }
    }
    return null;
}
