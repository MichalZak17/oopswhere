/** Theme preference. `auto` follows the OS (no cookie, no attribute); the others are forced. */
export type Theme = "auto" | "light" | "dark";

export const THEME_COOKIE = "ow_theme";
export const THEMES: Theme[] = ["auto", "light", "dark"];

/** Browser chrome colours; keep in sync with `--paper` in tokens.css. */
export const THEME_COLOR = { light: "#faf8f4", dark: "#141210" } as const;

export function asTheme(value: unknown): Theme {
    return value === "light" || value === "dark" ? value : "auto";
}
