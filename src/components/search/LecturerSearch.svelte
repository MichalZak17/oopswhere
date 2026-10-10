<script lang="ts">
    import type { Dict } from "@/i18n";
    import { pick } from "@/i18n/pick";
    import type { Lang } from "@/lib/timetable/types";
    import { MIN_QUERY, type Lecturer, type LecturerSearchResult } from "@/lib/lecturers/types";
    import { track } from "@/lib/analytics/client";

    interface Props {
        lang: Lang;
        dict: Dict["search"];
        /** Lecturer pages live at `${base}${id}`. */
        base: string;
        /** Search endpoint (GET ?q=). */
        api: string;
    }

    let { lang, dict, base, api }: Props = $props();

    let dialog: HTMLDialogElement;
    let input: HTMLInputElement;

    let query = $state("");
    let items = $state.raw<Lecturer[]>([]);
    let status = $state<"idle" | "loading" | "done" | "error">("idle");
    let active = $state(0);

    const cache = new Map<string, Lecturer[]>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;

    const normalize = (q: string) =>
        q.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase("pl");

    const message = $derived(
        status === "error"
            ? dict.error
            : status === "done" && items.length === 0
              ? dict.empty
              : status === "idle"
                ? dict.hint
                : status === "loading" && items.length === 0
                  ? dict.loading
                  : "",
    );
    const optionId = (i: number) => `lecturer-option-${i}`;

    function open(via: "button" | "key") {
        if (dialog.open) return;
        dialog.showModal();
        track("lecturer_search_opened", { via });
        input.select();
    }

    function close() {
        clearTimeout(timer);
        controller?.abort();
        dialog.close();
    }

    function show(list: Lecturer[]) {
        items = list;
        active = 0;
        status = "done";
    }

    async function run(q: string) {
        controller = new AbortController();
        try {
            const res = await fetch(`${api}?q=${encodeURIComponent(q)}`, {
                signal: controller.signal,
                headers: { Accept: "application/json" },
            });
            // Signed out in another tab: the page itself will explain.
            if (res.status === 401) return location.reload();
            if (!res.ok) throw new Error(String(res.status));
            const body = (await res.json()) as LecturerSearchResult;
            cache.set(q, body.items);
            show(body.items);
        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") return;
            status = "error";
        }
    }

    function oninput(e: Event & { currentTarget: HTMLInputElement }) {
        query = e.currentTarget.value;
        const q = normalize(query);
        clearTimeout(timer);
        controller?.abort();
        if (q.length < MIN_QUERY) {
            items = [];
            status = "idle";
            return;
        }
        const hit = cache.get(q);
        if (hit) return show(hit);
        // Keep the previous results on screen while typing; the list just dims.
        status = "loading";
        timer = setTimeout(() => void run(q), 180);
    }

    function opened(index: number) {
        track("lecturer_opened", { from: "search", position: index + 1 });
    }

    function move(delta: number) {
        if (items.length === 0) return;
        active = (active + delta + items.length) % items.length;
        document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
    }

    function onfieldkeydown(e: KeyboardEvent) {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            move(1);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            move(-1);
        } else if (e.key === "Enter" && items[active] && status !== "loading") {
            e.preventDefault();
            opened(active);
            location.assign(`${base}${items[active].id}`);
        }
    }

    // "/" opens the search from anywhere, unless the visitor is typing or a dialog is open.
    function onwindowkeydown(e: KeyboardEvent) {
        if (e.key !== "/" || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
        const target = e.target as HTMLElement | null;
        if (target?.closest("input, textarea, select, [contenteditable]")) return;
        if (document.querySelector("dialog[open]")) return;
        e.preventDefault();
        open("key");
    }

    function oncancel(e: Event) {
        e.preventDefault();
        close();
    }
    // Close on a click that both starts and ends on the backdrop (not a text-selection drag).
    let pressedBackdrop = false;
    function onpointerdown(e: PointerEvent) {
        pressedBackdrop = e.target === dialog;
    }
    function onclick(e: MouseEvent) {
        if (pressedBackdrop && e.target === dialog) close();
        pressedBackdrop = false;
    }
</script>

<svelte:window onkeydown={onwindowkeydown} />

<button
    class="trigger"
    type="button"
    aria-haspopup="dialog"
    aria-keyshortcuts="/"
    aria-label={dict.open}
    title={dict.open}
    onclick={() => open("button")}
>
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"
        ><circle
            cx="8.5"
            cy="8.5"
            r="5.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
        /><path
            d="M13 13l4 4"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
        /></svg
    >
    <span class="label">{dict.button}</span>
    <kbd aria-hidden="true">/</kbd>
</button>

<dialog
    bind:this={dialog}
    class="search"
    aria-label={dict.open}
    {oncancel}
    {onpointerdown}
    {onclick}
>
    <div class="panel">
        <div class="field">
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"
                ><circle
                    cx="8.5"
                    cy="8.5"
                    r="5.5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                /><path
                    d="M13 13l4 4"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                /></svg
            >
            <input
                bind:this={input}
                type="search"
                role="combobox"
                aria-label={dict.open}
                aria-autocomplete="list"
                aria-controls="lecturer-results"
                aria-expanded={items.length > 0}
                aria-activedescendant={items.length > 0 ? optionId(active) : undefined}
                autocomplete="off"
                autocapitalize="words"
                spellcheck="false"
                enterkeyhint="go"
                maxlength="60"
                placeholder={dict.placeholder}
                value={query}
                {oninput}
                onkeydown={onfieldkeydown}
            />
            <button class="close" type="button" onclick={close} aria-label={dict.close}>
                <kbd aria-hidden="true">Esc</kbd>
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"
                    ><path
                        d="M6 6l12 12M18 6L6 18"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linecap="round"
                    /></svg
                >
            </button>
        </div>

        <div
            id="lecturer-results"
            class="results"
            class:dim={status === "loading"}
            role="listbox"
            aria-label={dict.results}
            hidden={items.length === 0}
        >
            {#each items as lecturer, i (lecturer.id)}
                <a
                    id={optionId(i)}
                    class="option"
                    class:active={i === active}
                    role="option"
                    aria-selected={i === active}
                    tabindex="-1"
                    href={`${base}${lecturer.id}`}
                    onclick={() => opened(i)}
                    onpointermove={() => (active = i)}
                >
                    <span class="who">
                        {#if lecturer.before}<span class="title">{lecturer.before}</span>{/if}
                        <span class="name">{lecturer.first} {lecturer.last}</span
                        >{#if lecturer.after}<span class="title">, {lecturer.after}</span>{/if}
                    </span>
                    {#if lecturer.unit}
                        <span class="unit">{pick(lecturer.unit, lang)}</span>
                    {/if}
                    <span class="go" aria-hidden="true">→</span>
                </a>
            {/each}
        </div>

        <p class="status" role="status" hidden={!message}>{message}</p>
    </div>
</dialog>

<style>
    .trigger {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        height: 38px;
        padding: 0 8px 0 14px;
        border-radius: 999px;
        border: 1px solid var(--rule);
        color: var(--ink-2);
        font-weight: 550;
        transition:
            border-color var(--dur-1) var(--ease-out),
            background-color var(--dur-1) var(--ease-out),
            color var(--dur-1) var(--ease-out);
    }
    .trigger:hover {
        border-color: var(--rule-strong);
        background: var(--paper-sunk);
        color: var(--ink);
    }
    kbd {
        display: inline-grid;
        place-items: center;
        min-width: 22px;
        height: 22px;
        padding: 0 6px;
        border: 1px solid var(--rule);
        border-radius: var(--radius-s);
        font: inherit;
        font-size: 0.74rem;
        font-weight: 550;
        color: var(--ink-3);
    }

    .search {
        position: fixed;
        inset: 12vh 0 auto 0;
        width: min(640px, calc(100% - 2 * var(--gutter)));
        max-width: none;
        max-height: calc(100dvh - 12vh - 24px);
        margin: 0 auto;
        padding: 0;
        border: 1px solid var(--rule);
        border-radius: var(--radius-l);
        background: var(--paper-raised);
        color: var(--ink);
        box-shadow: var(--shadow-sheet);
        overflow: hidden;
        opacity: 1;
        transform: none;
        transition:
            opacity var(--dur-2) var(--ease-out),
            transform var(--dur-2) var(--ease-out),
            overlay var(--dur-2) allow-discrete,
            display var(--dur-2) allow-discrete;
    }
    @starting-style {
        .search[open] {
            opacity: 0;
            transform: translateY(-6px) scale(0.985);
        }
    }
    .search:not([open]) {
        opacity: 0;
        transform: translateY(-6px) scale(0.985);
    }
    .search::backdrop {
        background: light-dark(oklch(0.2 0.01 60 / 0.22), oklch(0 0 0 / 0.5));
    }
    .panel {
        display: flex;
        flex-direction: column;
        max-height: inherit;
    }

    .field {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 10px 0 18px;
        border-bottom: 1px solid var(--rule);
        color: var(--ink-3);
    }
    input {
        flex: 1;
        min-width: 0;
        height: 60px;
        border: 0;
        background: transparent;
        color: var(--ink);
        font: inherit;
        font-size: 1.12rem;
        font-weight: 520;
        letter-spacing: -0.01em;
        outline: none;
    }
    input::placeholder {
        color: var(--ink-3);
        font-weight: 400;
    }
    input::-webkit-search-cancel-button {
        display: none;
    }
    .close {
        display: grid;
        place-items: center;
        height: 36px;
        min-width: 36px;
        padding: 0 4px;
        border-radius: var(--radius-s);
        color: var(--ink-3);
    }
    .close svg {
        display: none;
    }
    .close:hover kbd {
        color: var(--ink);
        border-color: var(--rule-strong);
    }

    .results {
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 6px;
        transition: opacity var(--dur-1) var(--ease-out);
    }
    .results[hidden] {
        display: none;
    }
    .results.dim {
        opacity: 0.55;
    }
    .option {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        column-gap: 16px;
        align-items: center;
        padding: 10px 12px;
        border-radius: var(--radius-s);
        color: var(--ink);
        text-decoration: none;
    }
    .option.active {
        background: var(--paper-sunk);
    }
    .who {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .name {
        font-weight: 600;
    }
    .title {
        color: var(--ink-3);
    }
    .title:first-child {
        margin-right: 0.3em;
    }
    .unit {
        grid-column: 1;
        margin-top: 2px;
        font-size: 0.84rem;
        color: var(--ink-3);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .go {
        grid-column: 2;
        grid-row: 1 / span 2;
        color: var(--ink-3);
        opacity: 0;
        transform: translateX(-4px);
        transition:
            opacity var(--dur-1) var(--ease-out),
            transform var(--dur-1) var(--ease-out);
    }
    .option.active .go {
        opacity: 1;
        transform: none;
    }

    .status {
        padding: 18px 20px 20px;
        font-size: 0.92rem;
        color: var(--ink-3);
    }
    .status[hidden] {
        display: none;
    }

    @media (max-width: 560px) {
        .trigger {
            width: 38px;
            padding: 0;
            justify-content: center;
        }
        .label,
        .trigger kbd {
            display: none;
        }
        .search {
            inset-block-start: max(12px, env(safe-area-inset-top));
            width: calc(100% - 24px);
            max-height: calc(100dvh - 24px);
        }
        .close kbd {
            display: none;
        }
        .close svg {
            display: block;
        }
    }
</style>
