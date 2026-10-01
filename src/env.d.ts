/// <reference types="astro/client" />

declare namespace App {
    interface Locals {
        profile: import("./lib/profile").Profile | null;
        theme: import("./lib/theme").Theme;
    }
}
