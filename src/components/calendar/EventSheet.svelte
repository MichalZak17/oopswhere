<script lang="ts">
    import type { TimetablePayload, Lang } from "@/lib/timetable/types";
    import type { ClassEvent } from "./model";
    import {
        courseName,
        placeLabel,
        typeCode,
        typeName,
        type CalDict,
        type Types,
    } from "./display";
    import {
        capitalize,
        dayMonthShort,
        duration,
        fullDate,
        timeRange,
        weekdayShort,
    } from "./format";
    import { pick } from "@/i18n/pick";

    interface Props {
        event: ClassEvent | null;
        events: ClassEvent[];
        data: TimetablePayload;
        lang: Lang;
        dict: CalDict;
        types: Types;
        /** Called when the user asks to close (button, Esc, backdrop). */
        onrequestclose: () => void;
    }

    let { event, events, data, lang, dict, types, onrequestclose }: Props = $props();

    let dialog: HTMLDialogElement;
    let panel = $state<HTMLElement>();

    export function show() {
        if (!dialog.open) dialog.showModal();
    }
    export function hide() {
        if (dialog.open) dialog.close();
    }
    export function panelEl() {
        return panel;
    }

    const info = $derived(event ? data.groups[event.key] : undefined);
    const building = $derived(event?.buildingId ? data.buildings[event.buildingId] : undefined);
    const lecturers = $derived(
        (event?.lecturerIds ?? [])
            .map((id) => data.people[String(id)])
            .filter(Boolean)
            .map(([first, last, title]) => [title, first, last].filter(Boolean).join(" ")),
    );
    const upcoming = $derived(
        event
            ? events.filter(
                  (e) =>
                      e.key === event!.key &&
                      (e.date > event!.date || (e.date === event!.date && e.start > event!.start)),
              )
            : [],
    );

    // Short by default so the sheet fits a phone screen; expandable on demand.
    const PREVIEW = 4;
    let expanded = $state(false);
    $effect(() => {
        void event;
        expanded = false;
    });

    function oncancel(e: Event) {
        e.preventDefault();
        onrequestclose();
    }
    // A drag from inside the panel that ends on the backdrop (selecting text) fires its
    // click on the dialog too; only close when the press also started on the backdrop.
    let pressedBackdrop = false;
    function onpointerdown(e: PointerEvent) {
        pressedBackdrop = e.target === dialog;
    }
    function onclick(e: MouseEvent) {
        if (pressedBackdrop && e.target === dialog) onrequestclose();
        pressedBackdrop = false;
    }
</script>

<dialog
    bind:this={dialog}
    class="sheet"
    {oncancel}
    {onpointerdown}
    {onclick}
    aria-labelledby="sheet-title"
>
    {#if event && info}
        <div class="panel" bind:this={panel} data-type={info.type}>
            <header class="head">
                <p class="kind">
                    <span class="code">{typeCode(info)}</span>
                    {typeName(types, info, lang)} · {dict.group}&nbsp;{info.group}
                </p>
                <button class="close" onclick={onrequestclose} aria-label={dict.close}>
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"
                        ><path
                            d="M6 6l12 12M18 6L6 18"
                            stroke="currentColor"
                            stroke-width="1.6"
                            stroke-linecap="round"
                        /></svg
                    >
                </button>
            </header>

            <h2 id="sheet-title" class="course">{courseName(info, lang)}</h2>

            <dl class="facts">
                <div>
                    <dt>{dict.time}</dt>
                    <dd>
                        {capitalize(fullDate(lang, event.date))}
                        <span class="sub"
                            >{`${timeRange(event.start, event.end)} · ${duration(lang, event.end - event.start)}`}</span
                        >
                    </dd>
                </div>
                <div>
                    <dt>{dict.place}</dt>
                    <dd>
                        {event.room ? `${capitalize(dict.room)} ${event.room}` : "—"}{building
                            ? ` · ${building.label}`
                            : ""}
                        {#if building && pick(building.name, lang)}
                            <span class="sub">{pick(building.name, lang)}</span>
                        {/if}
                    </dd>
                </div>
                {#if lecturers.length > 0}
                    <div>
                        <dt>{dict.lecturers}</dt>
                        <dd>
                            {#each lecturers as name (name)}<span class="person">{name}</span
                                >{/each}
                        </dd>
                    </div>
                {/if}
            </dl>

            <section class="upcoming">
                <h3>{dict.meetings}</h3>
                {#if upcoming.length === 0}
                    <p class="none">{dict.noMoreMeetings}</p>
                {:else}
                    <ol>
                        {#each expanded ? upcoming : upcoming.slice(0, PREVIEW) as m (m.id)}
                            <li>
                                <span class="d"
                                    >{`${weekdayShort(lang, m.date)} ${dayMonthShort(lang, m.date)}`}</span
                                >
                                <span class="t">{timeRange(m.start, m.end)}</span>
                                <span class="p">{placeLabel(m, data.buildings)}</span>
                            </li>
                        {/each}
                    </ol>
                    {#if !expanded && upcoming.length > PREVIEW}
                        <button class="more" onclick={() => (expanded = true)}>
                            {dict.showAllMeetings} ({upcoming.length})
                        </button>
                    {/if}
                {/if}
            </section>

            {#if info.url}
                <a class="usos" href={info.url} target="_blank" rel="noopener noreferrer">
                    {dict.openUsos}
                    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"
                        ><path
                            d="M5 11l6-6M6 5h5v5"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.4"
                            stroke-linecap="round"
                        /></svg
                    >
                </a>
            {/if}
        </div>
    {/if}
</dialog>

<style>
    .sheet {
        position: fixed;
        inset: 0 0 auto 0;
        width: 100%;
        /* dvh = the visible viewport, so nothing hides behind mobile browser toolbars */
        height: 100vh;
        height: 100dvh;
        max-width: none;
        max-height: none;
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        color: var(--ink);
        overflow: hidden;
    }
    .sheet::backdrop {
        background: light-dark(oklch(0.2 0.01 60 / 0.22), oklch(0 0 0 / 0.5));
        animation: fade 220ms var(--ease-out);
    }
    @keyframes fade {
        from {
            opacity: 0;
        }
    }

    .panel {
        position: absolute;
        top: 12px;
        right: 12px;
        bottom: 12px;
        width: min(440px, calc(100% - 24px));
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 22px 26px 28px;
        border-radius: var(--radius-l);
        background: var(--paper-raised);
        box-shadow: var(--shadow-sheet);
    }
    :global(html:not([data-vt])) .sheet[open] .panel {
        animation: panel-in 340ms var(--ease-out);
    }
    @keyframes panel-in {
        from {
            opacity: 0;
            transform: translateX(18px);
        }
    }

    .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }
    .kind {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 0.84rem;
        color: var(--ink-2);
    }
    .code {
        display: inline-grid;
        place-items: center;
        min-width: 2.2em;
        height: 1.75em;
        padding: 0 0.5em;
        border-radius: 6px;
        font-weight: 650;
        font-size: 0.78rem;
        background: oklch(var(--tint-l) var(--tint-c) var(--h));
        color: oklch(var(--code-l) var(--rule-c) var(--h));
    }
    .close {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        margin-right: -8px;
        border-radius: 50%;
        color: var(--ink-2);
        transition: background-color var(--dur-1) var(--ease-out);
    }
    .close:hover {
        background: var(--paper-sunk);
        color: var(--ink);
    }

    .course {
        margin: 18px 0 22px;
        font-size: 1.6rem;
        line-height: 1.15;
        font-weight: 650;
        letter-spacing: -0.03em;
        text-wrap: balance;
    }

    .facts {
        display: grid;
        border-top: 1px solid var(--rule);
    }
    .facts > div {
        display: grid;
        grid-template-columns: 96px minmax(0, 1fr);
        gap: 12px;
        padding: 14px 0;
        border-bottom: 1px solid var(--rule);
    }
    dt {
        font-size: 0.78rem;
        color: var(--ink-3);
        padding-top: 2px;
    }
    dd {
        font-weight: 520;
    }
    .sub {
        display: block;
        margin-top: 2px;
        font-weight: 400;
        font-size: 0.88rem;
        color: var(--ink-2);
    }
    .person {
        display: block;
    }

    .upcoming {
        margin-top: 26px;
    }
    h3 {
        font-size: 0.74rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin-bottom: 8px;
    }
    .upcoming li {
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: 16px;
        padding: 8px 0;
        font-size: 0.9rem;
        border-bottom: 1px dashed var(--rule);
    }
    .upcoming .d::first-letter {
        text-transform: uppercase;
    }
    .upcoming .t,
    .upcoming .p {
        color: var(--ink-2);
    }
    .none {
        color: var(--ink-2);
        font-size: 0.9rem;
    }
    .more {
        margin-top: 10px;
        font-size: 0.88rem;
        color: var(--ink-2);
        text-decoration: underline;
        text-decoration-color: var(--rule-strong);
        text-underline-offset: 0.2em;
    }
    .more:hover {
        color: var(--ink);
    }

    .usos {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 26px;
        font-size: 0.9rem;
        color: var(--ink-2);
    }

    @media (max-width: 640px) {
        .panel {
            top: auto;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100%;
            max-height: calc(100dvh - 32px);
            padding: 18px 20px calc(24px + env(safe-area-inset-bottom));
            border-radius: 22px 22px 0 0;
        }
        .panel::before {
            content: "";
            display: block;
            width: 36px;
            height: 4px;
            margin: -6px auto 14px;
            border-radius: 2px;
            background: var(--rule-strong);
        }
        @keyframes panel-in {
            from {
                opacity: 0;
                transform: translateY(32px);
            }
        }
        .course {
            font-size: 1.4rem;
        }
    }
</style>
