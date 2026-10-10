/** Which USOS terms matter "now": shared by the login callback and lecturer pages. */
import { addDays, type LocalDate } from "@/lib/time/local-date";
import type { RawTerm } from "@/lib/usos/api";

/** How far ahead a term may start and still count (the next semester's groups appear early). */
export const TERM_HORIZON_DAYS = 120;

export function termFinish(term: RawTerm, fallback: LocalDate): LocalDate {
    return term.finish_date ?? term.end_date ?? fallback;
}

/** Terms that haven't finished and start within the next ~4 months. */
export function relevantTerms(terms: readonly RawTerm[], today: LocalDate): RawTerm[] {
    const horizon = addDays(today, TERM_HORIZON_DAYS);
    return terms.filter(
        (t) => termFinish(t, "9999-12-31") >= today && (t.start_date ?? "0000-01-01") <= horizon,
    );
}
