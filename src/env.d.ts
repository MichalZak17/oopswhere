/// <reference types="astro/client" />

declare namespace App {
    interface Locals {
        profile: import("./lib/profile").Profile | null;
        theme: import("./lib/theme").Theme;
        /** Answer to the analytics question; null = not asked yet. */
        consent: import("./lib/consent").Consent | null;
    }
}
