export function toBase64Url(bytes: Uint8Array): string {
    let bin = "";
    for (const byte of bytes) bin += String.fromCharCode(byte);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(text: string): Uint8Array | null {
    if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
    try {
        const padded =
            text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
        const bin = atob(padded);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    } catch {
        return null;
    }
}
