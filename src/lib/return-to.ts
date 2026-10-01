/** Only same-site paths we serve; anything else (other hosts, //, javascript:) falls back. */
export function safeReturnTo(value: unknown, fallback = "/"): string {
    if (typeof value !== "string") return fallback;
    return /^\/(en\/)?(demo)?(\?week=\d{4}-\d{2}-\d{2})?$/.test(value) ? value : fallback;
}
