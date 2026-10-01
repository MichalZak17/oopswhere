/**
 * Politeness towards USOS: at most `concurrency` calls in flight, and a circuit
 * breaker that stops calling for a while after a run of failures (stale data is
 * served meanwhile).
 */
export class CircuitOpenError extends Error {
    constructor() {
        super("USOS circuit open");
        this.name = "CircuitOpenError";
    }
}

export interface LimiterOptions {
    concurrency?: number;
    failureThreshold?: number;
    cooldownMs?: number;
    now?: () => number;
}

export class Limiter {
    private active = 0;
    private readonly queue: (() => void)[] = [];
    private failures = 0;
    private openUntil = 0;
    private readonly concurrency: number;
    private readonly failureThreshold: number;
    private readonly cooldownMs: number;
    private readonly now: () => number;

    constructor(opts: LimiterOptions = {}) {
        this.concurrency = opts.concurrency ?? 6;
        this.failureThreshold = opts.failureThreshold ?? 5;
        this.cooldownMs = opts.cooldownMs ?? 60_000;
        this.now = opts.now ?? Date.now;
    }

    get isOpen(): boolean {
        return this.now() < this.openUntil;
    }

    async run<T>(
        fn: () => Promise<T>,
        countsAsFailure: (err: unknown) => boolean = () => true,
    ): Promise<T> {
        if (this.isOpen) throw new CircuitOpenError();
        if (this.active >= this.concurrency) {
            await new Promise<void>((resolve) => this.queue.push(resolve));
        }
        this.active++;
        try {
            const result = await fn();
            this.failures = 0;
            return result;
        } catch (err) {
            if (countsAsFailure(err) && ++this.failures >= this.failureThreshold) {
                this.openUntil = this.now() + this.cooldownMs;
                this.failures = 0;
            }
            throw err;
        } finally {
            this.active--;
            this.queue.shift()?.();
        }
    }
}
