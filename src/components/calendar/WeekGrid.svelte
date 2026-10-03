<script lang="ts">
    import type { BuildingInfo, GroupInfo, GroupKey, Lang, LocalDate } from "@/lib/timetable/types";
    import type { TimeSpan } from "@/lib/layout/visible-range";
    import { placeDay, type ClassEvent } from "./model";
    import { weekdayLong, weekdayShort } from "./format";
    import { parts } from "@/lib/time/local-date";
    import EventCard from "./EventCard.svelte";
    import type { CalDict, Types } from "./display";

    interface Props {
        days: LocalDate[];
        byDate: Map<LocalDate, ClassEvent[]>;
        range: TimeSpan;
        today: LocalDate;
        nowMin: number;
        lang: Lang;
        dict: CalDict;
        types: Types;
        groups: Record<GroupKey, GroupInfo>;
        buildings: Record<string, BuildingInfo>;
        onopen: (ev: ClassEvent, el: HTMLElement) => void;
    }

    let {
        days,
        byDate,
        range,
        today,
        nowMin,
        lang,
        dict,
        types,
        groups,
        buildings,
        onopen,
    }: Props = $props();

    const hours = $derived(
        Array.from(
            { length: Math.floor((range.end - range.start) / 60) + 1 },
            (_, i) => range.start / 60 + i,
        ),
    );
    const placedByDay = $derived(days.map((d) => placeDay(byDate.get(d) ?? [])));
    const nowVisible = $derived(nowMin >= range.start && nowMin <= range.end);

    // Mobile: one day per screen, swiped with scroll-snap.
    let scroller: HTMLDivElement;
    let active = $state(0);

    function initialIndex(): number {
        const t = days.indexOf(today);
        if (t !== -1) return t;
        const withClasses = days.findIndex((d) => (byDate.get(d)?.length ?? 0) > 0);
        return Math.max(0, withClasses);
    }

    // Re-centre on the most useful day when the visible week changes — and only then,
    // so a re-render never yanks the user back from the day they swiped to.
    let centredOn = "";
    $effect(() => {
        const key = days.join();
        if (key === centredOn) return;
        centredOn = key;
        const i = initialIndex();
        active = i;
        if (scroller && scroller.scrollWidth > scroller.clientWidth) {
            scroller.scrollTo({ left: i * scroller.clientWidth, behavior: "instant" });
        }
    });

    function onscroll() {
        if (!scroller.clientWidth) return;
        active = Math.round(scroller.scrollLeft / scroller.clientWidth);
    }

    function goToDay(i: number) {
        scroller.scrollTo({ left: i * scroller.clientWidth, behavior: "smooth" });
    }
</script>

<div class="strip" role="tablist" aria-label={dict.week} style:--n={days.length} style:--a={active}>
    {#each days as day, i (day)}
        <button
            role="tab"
            aria-selected={active === i}
            class="chip"
            class:today={day === today}
            class:empty={(byDate.get(day)?.length ?? 0) === 0}
            onclick={() => goToDay(i)}
        >
            <span class="chip-dow">{weekdayShort(lang, day)}</span>
            <span class="chip-dom num">{parts(day).day}</span>
        </button>
    {/each}
    <span class="indicator" aria-hidden="true"></span>
</div>

<div
    class="grid"
    style:--from={range.start}
    style:--span-min={range.end - range.start}
    style:--cols={days.length}
>
    <div class="gutter" aria-hidden="true">
        <div class="gutter-body">
            {#each hours as h (h)}
                <span class="hour" style:--m={h * 60}>{h}:00</span>
            {/each}
        </div>
    </div>

    <div class="days" data-pager bind:this={scroller} {onscroll}>
        {#each days as day, di (day)}
            {@const placed = placedByDay[di] ?? []}
            {@const isToday = day === today}
            <section
                class="day"
                class:is-today={isToday}
                class:is-past={day < today}
                aria-labelledby="d-{day}"
            >
                <h2 class="day-head" id="d-{day}">
                    <span class="dow">{weekdayLong(lang, day)}</span>
                    <span class="dom num">{parts(day).day}</span>
                </h2>
                <ol class="day-body">
                    {#each placed as { ev, place }, i (ev.id)}
                        {@const past = ev.date < today || (isToday && ev.end <= nowMin)}
                        {@const running = isToday && ev.start <= nowMin && nowMin < ev.end}
                        <li
                            class="slot"
                            style:--s={ev.start}
                            style:--d={ev.end - ev.start}
                            style:--lane={place.lane}
                            style:--lanes={place.lanes}
                            style:--span={place.span}
                        >
                            <EventCard
                                {ev}
                                info={groups[ev.key]}
                                {buildings}
                                {lang}
                                {dict}
                                {types}
                                conflict={place.conflict}
                                {past}
                                progress={running
                                    ? (nowMin - ev.start) / (ev.end - ev.start)
                                    : null}
                                index={di * 3 + i}
                                {onopen}
                            />
                        </li>
                    {/each}
                </ol>
                {#if isToday && nowVisible}
                    <div class="now-line" style:--s={nowMin} aria-hidden="true"></div>
                {/if}
            </section>
        {/each}
    </div>
</div>

<style>
    .grid {
        --hour: 68px;
        --ppm: calc(var(--hour) / 60);
        --head: 58px;
        --gutter-w: 52px;
        display: grid;
        grid-template-columns: var(--gutter-w) minmax(0, 1fr);
    }
    /* Named only during a week slide (see Calendar.svelte). */
    :global(html[data-nav-dir]) .grid {
        view-transition-name: cal-days;
    }

    .gutter {
        padding-top: var(--head);
    }
    .gutter-body {
        position: relative;
        height: calc(var(--span-min) * var(--ppm));
    }
    .hour {
        position: absolute;
        right: 12px;
        top: calc((var(--m) - var(--from)) * var(--ppm));
        transform: translateY(-50%);
        font-size: 0.72rem;
        color: var(--ink-3);
        line-height: 1;
    }

    .days {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(0, 1fr);
        border-left: 1px solid var(--rule);
    }
    .day {
        position: relative;
        min-width: 0;
        border-right: 1px solid var(--rule);
    }
    .day:last-child {
        border-right-color: transparent;
    }
    .day-head {
        height: var(--head);
        display: flex;
        align-items: baseline;
        gap: 8px;
        padding: 18px 12px 0;
        font-size: 0.86rem;
        font-weight: 500;
        color: var(--ink-2);
        border-bottom: 1px solid var(--rule);
    }
    .dow::first-letter {
        text-transform: uppercase;
    }
    .dom {
        margin-left: auto;
        font-size: 1.05rem;
        font-weight: 620;
        color: var(--ink);
        letter-spacing: -0.02em;
    }
    .is-today .day-head {
        color: var(--ink);
    }
    .is-today .dom {
        display: inline-grid;
        place-items: center;
        min-width: 1.9em;
        height: 1.9em;
        margin-top: -0.35em;
        padding: 0 0.3em;
        border-radius: 999px;
        background: var(--accent);
        color: var(--accent-ink);
    }
    .is-past .day-head {
        color: var(--ink-3);
    }

    .day-body {
        position: relative;
        height: calc(var(--span-min) * var(--ppm));
        background-image:
            repeating-linear-gradient(to bottom, var(--rule) 0 1px, transparent 1px var(--hour)),
            repeating-linear-gradient(
                to bottom,
                transparent 0 calc(var(--hour) / 2),
                color-mix(in oklch, var(--rule) 45%, transparent) calc(var(--hour) / 2)
                    calc(var(--hour) / 2 + 1px),
                transparent calc(var(--hour) / 2 + 1px) var(--hour)
            );
    }
    .is-today .day-body {
        background-color: color-mix(in oklch, var(--accent) 3%, transparent);
    }

    .slot {
        position: absolute;
        top: calc((var(--s) - var(--from)) * var(--ppm) + 2px);
        height: max(26px, calc(var(--d) * var(--ppm) - 4px));
        left: calc(var(--lane) / var(--lanes) * 100%);
        width: calc(var(--span) / var(--lanes) * 100%);
        padding: 0 4px;
    }

    .now-line {
        position: absolute;
        left: 0;
        right: 0;
        top: calc(var(--head) + (var(--s) - var(--from)) * var(--ppm));
        height: 0;
        border-top: 1.5px solid var(--accent);
        pointer-events: none;
        z-index: 2;
        transition: top 1s linear;
    }
    .now-line::before {
        content: "";
        position: absolute;
        left: -5px;
        top: -5.5px;
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: var(--accent);
        box-shadow: 0 0 0 3px var(--paper);
    }

    /* Day strip only exists on narrow screens */
    .strip {
        display: none;
    }

    @container cal (width < 720px) {
        .grid {
            --hour: 74px;
            --gutter-w: 44px;
            --head: 0px;
        }
        .gutter {
            padding-top: 0;
        }
        .days {
            grid-auto-columns: 100%;
            overflow-x: auto;
            overscroll-behavior-x: contain;
            scroll-snap-type: x mandatory;
            scrollbar-width: none;
            border-left: 0;
        }
        .days::-webkit-scrollbar {
            display: none;
        }
        .day {
            scroll-snap-align: start;
            scroll-snap-stop: always;
            border-right: 0;
        }
        .day-head {
            display: none;
        }
        .slot {
            padding: 0 2px;
        }
        .strip {
            position: relative;
            display: grid;
            grid-template-columns: repeat(var(--n), minmax(0, 1fr));
            margin: 0 0 12px var(--gutter-w, 44px);
            padding: 4px;
            border-radius: 14px;
            background: var(--paper-sunk);
        }
        .chip {
            position: relative;
            z-index: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1px;
            padding: 7px 0 6px;
            border-radius: 10px;
            color: var(--ink-2);
            transition: color var(--dur-2) var(--ease-out);
        }
        .chip[aria-selected="true"] {
            color: var(--ink);
        }
        .chip.empty {
            color: var(--ink-3);
        }
        .chip-dow {
            font-size: 0.72rem;
            text-transform: capitalize;
        }
        .chip-dom {
            font-size: 1rem;
            font-weight: 620;
            letter-spacing: -0.02em;
        }
        .chip.today .chip-dom {
            color: var(--accent-text);
        }
        .indicator {
            position: absolute;
            top: 4px;
            bottom: 4px;
            left: 4px;
            width: calc((100% - 8px) / var(--n));
            border-radius: 10px;
            background: var(--paper-raised);
            box-shadow: 0 1px 2px oklch(0 0 0 / 0.08);
            transform: translateX(calc(var(--a) * 100%));
            transition: transform 360ms var(--ease-spring);
        }
    }
</style>
