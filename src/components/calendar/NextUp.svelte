<script lang="ts">
    import type { BuildingInfo, GroupInfo, GroupKey, Lang, LocalDate } from "@/lib/timetable/types";
    import type { ClassEvent } from "./model";
    import {
        courseName,
        placeLabel,
        relativeStart,
        typeCode,
        type CalDict,
        type Types,
    } from "./display";
    import { duration, formatMinutes } from "./format";

    interface Props {
        current: ClassEvent[];
        next: ClassEvent | null;
        today: LocalDate;
        nowMin: number;
        lang: Lang;
        dict: CalDict;
        types: Types;
        groups: Record<GroupKey, GroupInfo>;
        buildings: Record<string, BuildingInfo>;
        onopen: (ev: ClassEvent, el: HTMLElement) => void;
    }

    let { current, next, today, nowMin, lang, dict, types, groups, buildings, onopen }: Props =
        $props();
</script>

{#if current.length > 0 || next}
    <div class="nextup" aria-live="polite">
        {#each current as ev (ev.id)}
            <button
                class="row now"
                data-type={groups[ev.key]?.type}
                onclick={(e) => onopen(ev, e.currentTarget)}
            >
                <span class="label"><span class="pulse" aria-hidden="true"></span>{dict.now}</span>
                <span class="what">{courseName(groups[ev.key], lang)}</span>
                <span class="where"
                    ><b>{typeCode(groups[ev.key])}</b> · {placeLabel(ev, buildings)}</span
                >
                <span class="when">{dict.endsIn} {duration(lang, ev.end - nowMin)}</span>
            </button>
        {/each}
        {#if next}
            <button
                class="row"
                data-type={groups[next.key]?.type}
                onclick={(e) => onopen(next, e.currentTarget)}
            >
                <span class="label">{dict.next}</span>
                <span class="what">{courseName(groups[next.key], lang)}</span>
                <span class="where"
                    ><b>{typeCode(groups[next.key])}</b> · {placeLabel(next, buildings)}</span
                >
                <span class="when"
                    >{relativeStart(lang, dict, next, today, nowMin)}{#if next.date === today}<span
                            class="at"
                        >
                            · {formatMinutes(next.start)}</span
                        >{/if}</span
                >
            </button>
        {/if}
    </div>
{/if}

<style>
    .nextup {
        display: grid;
        margin-bottom: 28px;
        border-top: 1px solid var(--rule);
    }
    .row {
        display: grid;
        grid-template-columns: 96px minmax(0, 1fr) auto auto;
        align-items: baseline;
        gap: 4px 20px;
        padding: 13px 4px;
        border-bottom: 1px solid var(--rule);
        text-align: left;
        transition: background-color var(--dur-1) var(--ease-out);
    }
    .row:hover {
        background: var(--paper-sunk);
    }
    .label {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 0.74rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--ink-3);
    }
    .now .label {
        color: var(--accent-text);
    }
    .pulse {
        position: relative;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--accent);
    }
    .pulse::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: var(--accent);
        animation: pulse 2.4s var(--ease-out) infinite;
    }
    @keyframes pulse {
        from {
            transform: scale(1);
            opacity: 0.6;
        }
        to {
            transform: scale(3.2);
            opacity: 0;
        }
    }
    .what {
        font-weight: 600;
        letter-spacing: -0.012em;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .where {
        color: var(--ink-2);
        font-size: 0.88rem;
        white-space: nowrap;
    }
    .where b {
        font-weight: 650;
        color: oklch(var(--code-l) var(--rule-c) var(--h));
    }
    .when {
        color: var(--ink-2);
        font-size: 0.88rem;
        white-space: nowrap;
        text-align: right;
    }
    .now .when {
        color: var(--ink);
    }

    @container cal (width < 720px) {
        .row {
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 2px 12px;
            padding: 12px 2px;
        }
        .label {
            grid-column: 1 / -1;
        }
        .where {
            grid-column: 1;
        }
        .when {
            grid-row: 2;
            grid-column: 2;
        }
        .at {
            display: none;
        }
    }
</style>
