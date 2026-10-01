import type { APIRoute } from "astro";
import { clearProfile, safeReturnTo } from "@/lib/cookies";

export const POST: APIRoute = async ({ request, url, cookies, redirect }) => {
    const form = await request.formData().catch(() => null);
    clearProfile(cookies, url);
    const to = safeReturnTo(form?.get("returnTo"));
    return redirect(to.startsWith("/en") ? "/en/" : "/", 303);
};

export const GET: APIRoute = ({ redirect }) => redirect("/", 303);
