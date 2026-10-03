/**
 * Thin wrappers around same-document View Transitions. Everything degrades to an
 * instant update when the API is missing or the user prefers reduced motion.
 */

export function canAnimate(): boolean {
    return (
        typeof document !== "undefined" &&
        "startViewTransition" in document &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches
    );
}

type Update = () => Promise<void> | void;

/**
 * Waits for a transition to finish. A transition the browser aborts (e.g. while the
 * tab is hidden) rejects `ready` and `finished`; the DOM update still happens, so we
 * just swallow those rejections instead of letting them surface as uncaught errors.
 */
async function settle(vt: ViewTransition): Promise<void> {
    vt.ready.catch(() => {});
    vt.updateCallbackDone.catch(() => {});
    await vt.finished.catch(() => {});
}

/** Week/day change: slides the calendar content in the direction of travel. */
export async function slide(dir: "next" | "prev", update: Update): Promise<void> {
    if (!canAnimate()) {
        await update();
        return;
    }
    const root = document.documentElement;
    root.dataset.navDir = dir;
    try {
        await settle(
            document.startViewTransition(async () => {
                await update();
            }),
        );
    } catch {
        // a newer transition interrupted this one — fine
    } finally {
        delete root.dataset.navDir;
    }
}

/**
 * Whether the element is really on screen: in the viewport and not scrolled away inside
 * the mobile day pager. A named element escapes its scroll container's clipping during a
 * transition, so morphing to a card on another day would fly off the edge of the screen.
 */
function onScreen(el: HTMLElement): boolean {
    const r = el.getBoundingClientRect();
    const clip = el.closest("[data-pager]")?.getBoundingClientRect();
    const left = clip?.left ?? 0;
    const right = clip?.right ?? innerWidth;
    return r.width > 0 && r.right > left && r.left < right && r.bottom > 0 && r.top < innerHeight;
}

/**
 * Shared-element morph between two elements (card ↔ detail sheet). If the target isn't
 * on screen after the update, the source just fades out where it is.
 */
export async function morph(
    from: Element | null | undefined,
    to: () => Element | null | undefined,
    update: Update,
): Promise<void> {
    if (!canAnimate() || !(from instanceof HTMLElement)) {
        await update();
        return;
    }
    from.style.viewTransitionName = "ev-morph";
    let target: HTMLElement | null = null;
    try {
        await settle(
            document.startViewTransition(async () => {
                from.style.viewTransitionName = "";
                await update();
                const el = to();
                if (el instanceof HTMLElement && onScreen(el)) {
                    target = el;
                    el.style.viewTransitionName = "ev-morph";
                }
            }),
        );
    } catch {
        // interrupted
    } finally {
        from.style.viewTransitionName = "";
        if (target) (target as HTMLElement).style.viewTransitionName = "";
    }
}
