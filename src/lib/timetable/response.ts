/** The JSON response for a timetable endpoint: ETag, 304s, never shared-cached. */
import type { TimetablePayload } from "./types";

async function etagOf(body: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
    const hex = Array.from(new Uint8Array(digest).slice(0, 12), (b) =>
        b.toString(16).padStart(2, "0"),
    ).join("");
    return `"${hex}"`;
}

export async function timetableResponse(
    request: Request,
    payload: TimetablePayload,
): Promise<Response> {
    // generatedAt/now change every call; leave them out of the validator.
    const etag = await etagOf(JSON.stringify({ ...payload, generatedAt: 0, nowMin: 0 }));
    const headers = {
        "Cache-Control": "private, no-cache",
        ETag: etag,
        Vary: "Cookie",
    };
    if (request.headers.get("If-None-Match") === etag)
        return new Response(null, { status: 304, headers });
    return Response.json(payload, { headers });
}

/** JSON errors are never cached. */
export function jsonError(error: string, status: number): Response {
    return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}
