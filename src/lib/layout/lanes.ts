/**
 * Side-by-side layout for overlapping events in one day column.
 *
 * Events are swept into clusters of transitively overlapping events; inside a cluster
 * each event takes the first lane that is free at its start, and then stretches right
 * over any lanes that stay free for its whole duration. Touching events (end == start)
 * do not overlap. Only pairs that truly overlap are flagged as a conflict.
 */

export interface LaneInput {
    id: string;
    start: number;
    end: number;
}

export interface Placement {
    /** 0-based lane index. */
    lane: number;
    /** Number of lanes in this event's cluster. */
    lanes: number;
    /** How many lanes this event spans (≥ 1). */
    span: number;
    /** True when the event overlaps at least one other event. */
    conflict: boolean;
}

const overlaps = (a: LaneInput, b: LaneInput) => a.start < b.end && b.start < a.end;

export function layoutDay(events: readonly LaneInput[]): Map<string, Placement> {
    const sorted = [...events].sort(
        (a, b) => a.start - b.start || b.end - a.end || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
    const result = new Map<string, Placement>();

    let cluster: LaneInput[] = [];
    let clusterEnd = -Infinity;

    const flush = () => {
        if (cluster.length === 0) return;
        const laneEnds: number[] = [];
        const laneOf = new Map<string, number>();
        for (const ev of cluster) {
            let lane = laneEnds.findIndex((end) => end <= ev.start);
            if (lane === -1) lane = laneEnds.length;
            laneEnds[lane] = ev.end;
            laneOf.set(ev.id, lane);
        }
        const lanes = laneEnds.length;
        for (const ev of cluster) {
            const lane = laneOf.get(ev.id)!;
            let span = 1;
            while (
                lane + span < lanes &&
                !cluster.some(
                    (o) => o !== ev && laneOf.get(o.id) === lane + span && overlaps(o, ev),
                )
            ) {
                span++;
            }
            const conflict = cluster.some((o) => o !== ev && overlaps(o, ev));
            result.set(ev.id, { lane, lanes, span, conflict });
        }
        cluster = [];
        clusterEnd = -Infinity;
    };

    for (const ev of sorted) {
        if (ev.start >= clusterEnd) flush();
        cluster.push(ev);
        clusterEnd = Math.max(clusterEnd, ev.end);
    }
    flush();
    return result;
}
