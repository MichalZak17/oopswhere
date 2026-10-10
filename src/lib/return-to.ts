/** Only same-site paths we serve; anything else (other hosts, //, javascript:) falls back. */
export function safeReturnTo(value: unknown, fallback = "/"): string {
    if (typeof value !== "string") return fallback;
    return /^\/(en\/)?(demo|lecturer\/[1-9]\d{0,9})?(\?week=\d{4}-\d{2}-\d{2})?$/.test(value)
        ? value
        : fallback;
}
