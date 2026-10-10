/**
 * URLs that name a person never reach analytics: the automatic browser events carry the page
 * URL (and referrer), so ids in our paths are replaced before an event leaves the browser.
 */
const PERSONAL_PATHS: [RegExp, string][] = [[/\/lecturer\/\d+/g, "/lecturer/[id]"]];

export function scrubUrl(value: string): string {
    return PERSONAL_PATHS.reduce(
        (v, [pattern, placeholder]) => v.replace(pattern, placeholder),
        value,
    );
}

/** Scrubs every string value in place (event properties, `$set`, `$set_once`). */
export function scrubProperties(props: Record<string, unknown> | undefined): void {
    if (!props) return;
    for (const [key, value] of Object.entries(props))
        if (typeof value === "string") props[key] = scrubUrl(value);
}
