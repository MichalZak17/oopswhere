<script lang="ts">
    import type { BuildingInfo, GroupInfo, Lang } from "@/lib/timetable/types";
    import type { ClassEvent } from "./model";
    import { courseName, placeLabel, typeCode, type CalDict, type Types } from "./display";
    import { timeRange } from "./format";

    interface Props {
        ev: ClassEvent;
        info: GroupInfo | undefined;
        buildings: Record<string, BuildingInfo>;
        lang: Lang;
        dict: CalDict;
        types: Types;
        conflict: boolean;
        past: boolean;
        /** 0–1 while the class is running, otherwise null. */
        progress: number | null;
        index: number;
        onopen: (ev: ClassEvent, el: HTMLElement) => void;
    }

    let { ev, info, buildings, lang, dict, types, conflict, past, progress, index, onopen }: Props =
        $props();

    let el: HTMLButtonElement;
</script>

<button
    bind:this={el}
    class="ev"
    class:past
    class:current={progress !== null}
    class:conflict
    data-type={info?.type ?? ""}
    data-ev={ev.id}
    style:--p={progress ?? 0}
    style:--i={index}
    onclick={() => onopen(ev, el)}
>
    <span class="time">{timeRange(ev.start, ev.end)}</span>
    <span class="title">{courseName(info, lang)}</span>
    <span class="meta">
        <b>{typeCode(info)}</b><span class="grp"
            ><span class="sep">·</span>{dict.group}&nbsp;{info?.group}</span
        ><span class="sep">·</span><span class="place">{placeLabel(ev, buildings)}</span>
    </span>
    {#if conflict}<span class="flag">{dict.clash}</span>{/if}
</button>

<style>
    .ev {
        container-type: size;
        position: relative;
        isolation: isolate;
        display: flex;
        flex-direction: column;
        gap: 3px;
        width: 100%;
        height: 100%;
        padding: 8px 10px 8px 13px;
        overflow: hidden;
        text-align: left;
        border-radius: var(--radius-m);
        background: oklch(var(--tint-l) var(--tint-c) var(--h));
        color: var(--ink);
        transition:
            transform var(--dur-2) var(--ease-out),
            box-shadow var(--dur-2) var(--ease-out),
            opacity var(--dur-2) var(--ease-out);
    }
    .ev::before {
        content: "";
        position: absolute;
        inset: 6px auto 6px 5px;
        width: 2.5px;
        border-radius: 2px;
        background: oklch(var(--rule-l) var(--rule-c) var(--h));
    }
    /* elapsed part of a running class */
    .ev.current::after {
        content: "";
        position: absolute;
        inset: 0 0 auto 0;
        height: calc(var(--p) * 100%);
        background: oklch(var(--tint-strong-l) var(--tint-strong-c) var(--h));
        z-index: -1;
        transition: height 1s linear;
    }
    .ev:hover {
        transform: translateY(-1px);
        box-shadow: var(--shadow-lift);
    }
    .ev:active {
        transform: scale(0.985);
    }
    .ev.past {
        opacity: 0.5;
    }
    .ev.past:hover {
        opacity: 0.85;
    }
    .ev.conflict {
        box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 55%, transparent);
    }

    .time {
        font-size: 0.74rem;
        color: var(--ink-2);
        letter-spacing: 0.01em;
    }
    .title {
        font-weight: 620;
        font-size: 0.9rem;
        line-height: 1.22;
        letter-spacing: -0.012em;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
    .meta {
        margin-top: auto;
        font-size: 0.76rem;
        color: var(--ink-2);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .meta b {
        font-weight: 650;
        color: oklch(var(--code-l) var(--rule-c) var(--h));
    }
    .sep {
        color: var(--ink-3);
        margin: 0 0.15em;
    }
    .flag {
        position: absolute;
        top: 7px;
        right: 8px;
        font-size: 0.66rem;
        font-weight: 650;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--accent-text);
    }

    @container (height < 78px) {
        .title {
            -webkit-line-clamp: 2;
            line-clamp: 2;
        }
    }
    @container (height < 60px) {
        .meta {
            display: none;
        }
        .title {
            -webkit-line-clamp: 1;
            line-clamp: 1;
        }
    }
    @container (width < 150px) {
        .flag,
        .grp {
            display: none;
        }
    }

    :global(.intro) .ev {
        animation: ev-in 520ms var(--ease-out) both;
        animation-delay: min(calc(var(--i) * 35ms + 80ms), 420ms);
    }
    @keyframes ev-in {
        from {
            opacity: 0;
            transform: translateY(8px) scale(0.985);
        }
    }
</style>
