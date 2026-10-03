<script lang="ts">
    import { onMount, tick } from "svelte";
    import type { Lang, LocalDate, TimetablePayload } from "@/lib/timetable/types";
    import { addDays, isoWeek, startOfWeek, weekday } from "@/lib/time/local-date";
    import { zonedNow } from "@/lib/time/zoned-now";
    import { activeWeekdays, hourRange } from "@/lib/layout/visible-range";
    import {
        classWeeks,
        currentAndNext,
        expand,
        firstOnOrAfter,
        headingSpan,
        indexByDate,
        isWeekendProgramme,
        landingWeek,
        visibleDays,
        weekDates,
        type ClassEvent,
    } from "./model";
    import { fullDate, weekHeading } from "./format";
    import { canAnimate, morph, slide } from "./transitions";
    import { track } from "@/lib/analytics/client";
    import type { CalDict, Types } from "./display";
    import WeekGrid from "./WeekGrid.svelte";
    import NextUp from "./NextUp.svelte";
    import EventSheet from "./EventSheet.svelte";

    interface Props {
        payload: TimetablePayload;
        lang: Lang;
        dict: CalDict;
        types: Types;
        initialWeek?: LocalDate | null;
        /** JSON endpoint with the same payload, for refreshes. */
        apiUrl: string;
    }

    let { payload, lang, dict, types, initialWeek = null, apiUrl }: Props = $props();

    // ---- data & clock ---------------------------------------------------------
    let fetched = $state.raw<TimetablePayload | null>(null);
    const data = $derived(fetched ?? payload);
    let live = $state.raw<{ today: LocalDate; nowMin: number } | null>(null);
    const today = $derived(live?.today ?? data.today);
    const nowMin = $derived(live?.nowMin ?? data.nowMin);
    let loadState = $state<"idle" | "loading" | "failed">("idle");
    let lastFetch = 0;

    // ---- navigation state -----------------------------------------------------
    let anchorOverride = $state<LocalDate | null>(null);
    const defaultWeek = $derived(landingWeek(expand(payload), payload.today, payload.nowMin));
    const anchor = $derived(
        anchorOverride ?? (initialWeek ? startOfWeek(initialWeek) : defaultWeek),
    );
    let showAll = $state(false);
    let selected = $state.raw<ClassEvent | null>(null);
    let intro = $state(true);
    let sheet: ReturnType<typeof EventSheet>;

    // ---- derived view model ---------------------------------------------------
    const events = $derived(expand(data));
    const byDate = $derived(indexByDate(events));
    const activeDays = $derived(activeWeekdays(events.map((e) => weekday(e.date))));
    const range = $derived(hourRange(events));
    const dates = $derived(weekDates(anchor));
    const days = $derived(visibleDays(dates, activeDays, byDate, showAll));
    const weekCount = $derived(days.reduce((n, d) => n + (byDate.get(d)?.length ?? 0), 0));
    const weeks = $derived(classWeeks(events));
    const sessionNo = $derived(weeks.indexOf(anchor) + 1);
    const weekend = $derived(isWeekendProgramme(activeDays));
    const thisWeek = $derived(startOfWeek(today));
    const upcoming = $derived(currentAndNext(events, today, nowMin));
    const nextFrom = $derived(firstOnOrAfter(events, anchor));

    const soon = $derived(
        upcoming.next && upcoming.next.date <= addDays(today, 1) ? upcoming.next : null,
    );
    const canToggleDays = $derived(activeDays.length < 7);

    const eyebrow = $derived(
        weekend && sessionNo > 0
            ? `${dict.session} ${sessionNo} ${dict.of} ${weeks.length}`
            : `${dict.week} ${isoWeek(anchor)}`,
    );
    const title = $derived(weekHeading(lang, headingSpan(dates, days, weekCount, showAll)));

    // ---- actions ---------------------------------------------------------------
    function setWeek(target: LocalDate) {
        if (target === anchor) return;
        const dir = target > anchor ? "next" : "prev";
        track("week_changed", { direction: dir, to_this_week: target === thisWeek });
        void slide(dir, async () => {
            anchorOverride = target;
            await tick();
        });
    }
    const go = (delta: number) => setWeek(addDays(anchor, 7 * delta));
    const goToday = () => setWeek(thisWeek);

    /** The card or "Next up" row the open sheet came from; the sheet closes back into it. */
    let opener: HTMLElement | null = null;

    async function openEvent(ev: ClassEvent, el: HTMLElement) {
        track("class_opened");
        opener = el;
        await morph(
            el,
            () => sheet.panelEl(),
            async () => {
                // From "Next up": bring its week into view under the sheet.
                const week = startOfWeek(ev.date);
                if (week !== anchor) anchorOverride = week;
                selected = ev;
                await tick();
                sheet.show();
            },
        );
    }

    async function closeEvent() {
        if (!selected) return;
        const id = selected.id;
        const from = opener?.isConnected ? opener : null;
        opener = null;
        await morph(
            sheet.panelEl(),
            () => from ?? document.querySelector(`[data-ev="${CSS.escape(id)}"]`),
            async () => {
                // close() returns focus to whatever had it before; help only where the
                // click didn't focus the opener (Safari), and never scroll to it.
                sheet.hide();
                selected = null;
                await tick();
                if (document.activeElement === document.body) from?.focus({ preventScroll: true });
            },
        );
    }

    function toggleDays() {
        showAll = !showAll;
        track("all_days_toggled", { show_all: showAll });
        try {
            localStorage.setItem("ow:allDays", showAll ? "1" : "0");
        } catch {
            // storage blocked — fine
        }
    }

    async function refresh(reason: "missing" | "resume" | "retry") {
        loadState = "loading";
        try {
            const res = await fetch(apiUrl, { headers: { Accept: "application/json" } });
            if (!res.ok) throw new Error(String(res.status));
            fetched = (await res.json()) as TimetablePayload;
            lastFetch = Date.now();
            loadState = fetched.missing.length ? "failed" : "idle";
        } catch {
            loadState = "failed";
        }
        track("timetable_refreshed", { reason, ok: loadState === "idle" });
    }

    function onkeydown(e: KeyboardEvent) {
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || selected) return;
        const target = e.target as HTMLElement | null;
        if (target?.closest("input, textarea, select, [contenteditable], [popover]")) return;
        if (e.key === "ArrowLeft") {
            e.preventDefault();
            go(-1);
        } else if (e.key === "ArrowRight") {
            e.preventDefault();
            go(1);
        } else if (e.key === "t" || e.key === "T") {
            goToday();
        }
    }

    // The tab shows the week on screen; the server renders the first one into <title>.
    $effect(() => {
        document.title = title;
    });

    // Keep ?week= in the address bar so reloads and shared links land on the same week.
    $effect(() => {
        const url = new URL(location.href);
        if (anchor === defaultWeek) url.searchParams.delete("week");
        else url.searchParams.set("week", anchor);
        if (url.href !== location.href) history.replaceState(history.state, "", url);
    });

    onMount(() => {
        if (canAnimate()) document.documentElement.dataset.vt = "";
        try {
            showAll = localStorage.getItem("ow:allDays") === "1";
        } catch {
            // ignore
        }
        lastFetch = Date.now();
        const tickClock = () => (live = zonedNow(data.timeZone));
        tickClock();
        const clock = setInterval(tickClock, 30_000);
        const onVisible = () => {
            if (document.visibilityState !== "visible") return;
            tickClock();
            if (Date.now() - lastFetch > 30 * 60_000) void refresh("resume");
        };
        document.addEventListener("visibilitychange", onVisible);
        if (payload.missing.length > 0) void refresh("missing");
        const introTimer = setTimeout(() => (intro = false), 900);
        return () => {
            clearInterval(clock);
            clearTimeout(introTimer);
            document.removeEventListener("visibilitychange", onVisible);
        };
    });
</script>

<svelte:window {onkeydown} />

<div class="cal" class:intro>
    <header class="head">
        <div class="title">
            <p class="eyebrow num">{eyebrow}</p>
            <h1 class="range">{title}</h1>
        </div>
        <nav class="nav" aria-label={dict.week}>
            <button
                class="icon"
                onclick={() => go(-1)}
                aria-label={dict.prevWeek}
                title={dict.prevWeek}
            >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"
                    ><path
                        d="M14.5 6l-6 6 6 6"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    /></svg
                >
            </button>
            <button class="today" onclick={goToday} disabled={anchor === thisWeek}
                >{dict.today}</button
            >
            <button
                class="icon"
                onclick={() => go(1)}
                aria-label={dict.nextWeek}
                title={dict.nextWeek}
            >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"
                    ><path
                        d="M9.5 6l6 6-6 6"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    /></svg
                >
            </button>
        </nav>
    </header>

    {#if data.stale.length > 0}
        <p class="notice">{dict.stale}</p>
    {/if}
    {#if data.gone.length > 0}
        <p class="notice">{dict.gone}</p>
    {/if}
    {#if loadState === "failed" || (loadState === "idle" && fetched && fetched.missing.length > 0)}
        <p class="notice">
            {dict.missing}
            <button class="link" onclick={() => refresh("retry")}>{dict.retry}</button>
        </p>
    {/if}

    <NextUp
        current={upcoming.current}
        next={soon}
        {today}
        {nowMin}
        {lang}
        {dict}
        {types}
        groups={data.groups}
        buildings={data.buildings}
        onopen={openEvent}
    />

    {#if weekCount > 0}
        <WeekGrid
            {days}
            {byDate}
            {range}
            {today}
            {nowMin}
            {lang}
            {dict}
            {types}
            groups={data.groups}
            buildings={data.buildings}
            onopen={openEvent}
        />
    {:else}
        <div class="empty">
            <p class="empty-title">{loadState === "loading" ? dict.loading : dict.emptyTitle}</p>
            {#if loadState !== "loading"}
                {#if nextFrom}
                    <p class="empty-next">
                        {dict.emptyNext}
                        <strong>{fullDate(lang, nextFrom.date)}</strong>
                    </p>
                    <button
                        class="btn btn-ghost"
                        onclick={() => setWeek(startOfWeek(nextFrom.date))}
                    >
                        {dict.jump}
                        <span class="arrow" aria-hidden="true">→</span>
                    </button>
                {:else}
                    <p class="empty-next">{dict.emptyNone}</p>
                {/if}
            {/if}
        </div>
    {/if}

    <footer class="foot">
        <p class="scope">{dict.scope}</p>
        {#if canToggleDays}
            <button class="link" onclick={toggleDays} aria-pressed={showAll}>
                {showAll ? dict.classDays : dict.allDays}
            </button>
        {/if}
    </footer>
</div>

<EventSheet
    bind:this={sheet}
    event={selected}
    {events}
    {data}
    {lang}
    {dict}
    {types}
    onrequestclose={closeEvent}
/>

<style>
    .cal {
        container: cal / inline-size;
    }

    .head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 28px;
    }
    .title {
        min-width: 0;
    }
    /* Named only during a week slide, so other transitions (the card morph) leave them alone. */
    :global(html[data-nav-dir]) .title {
        view-transition-name: cal-title;
    }
    :global(html[data-nav-dir]) .empty {
        view-transition-name: cal-days;
    }
    .eyebrow {
        font-size: 0.8rem;
        font-weight: 550;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin-bottom: 6px;
    }
    .range {
        font-size: clamp(1.9rem, 1.2rem + 2.6vw, 3.1rem);
        line-height: 1.02;
        font-weight: 650;
        letter-spacing: -0.04em;
    }

    .nav {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
    }
    .icon,
    .today {
        display: grid;
        place-items: center;
        height: 40px;
        border-radius: 999px;
        color: var(--ink);
        transition:
            background-color var(--dur-1) var(--ease-out),
            opacity var(--dur-1) var(--ease-out),
            transform var(--dur-1) var(--ease-out);
    }
    .icon {
        width: 40px;
    }
    .today {
        padding: 0 16px;
        font-weight: 550;
        border: 1px solid var(--rule-strong);
    }
    .icon:hover,
    .today:hover {
        background: var(--paper-sunk);
    }
    .icon:active,
    .today:active {
        transform: scale(0.94);
    }
    .today:disabled {
        opacity: 0.4;
        pointer-events: none;
    }

    .notice {
        margin-bottom: 16px;
        padding: 10px 14px;
        border-radius: var(--radius-m);
        background: var(--paper-sunk);
        color: var(--ink-2);
        font-size: 0.9rem;
    }

    .link {
        color: var(--ink-2);
        text-decoration: underline;
        text-decoration-color: var(--rule-strong);
        text-underline-offset: 0.2em;
    }
    .link:hover {
        color: var(--ink);
        text-decoration-color: currentColor;
    }

    .empty {
        display: grid;
        justify-items: start;
        gap: 12px;
        padding: 40px 0 56px;
        border-top: 1px solid var(--rule);
    }
    .empty-title {
        font-size: clamp(1.8rem, 1.3rem + 1.8vw, 2.6rem);
        font-weight: 650;
        letter-spacing: -0.045em;
        line-height: 1;
    }
    .empty-next {
        color: var(--ink-2);
        font-size: 1.05rem;
    }
    .empty-next strong {
        color: var(--ink);
        font-weight: 600;
    }
    .empty .btn {
        margin-top: 8px;
    }

    .foot {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        flex-wrap: wrap;
        gap: 8px 24px;
        margin-top: 28px;
        font-size: 0.84rem;
        color: var(--ink-3);
    }

    @container cal (width < 720px) {
        .head {
            margin-bottom: 20px;
        }
        .today {
            padding: 0 12px;
        }
        .empty {
            padding: 32px 0 40px;
        }
    }
</style>
