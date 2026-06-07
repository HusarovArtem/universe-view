export const TimeSpeed = Object.freeze({
    PAUSED:     0,
    REAL:       1,
    FAST_10:    10,
    FAST_100:   100,
    FAST_1000:  1000,
    REWIND_1:   -1,
    REWIND_10:  -10,
    REWIND_100: -100,
});

/**
 * Centralized simulation clock. All time-dependent systems subscribe here.
 * Decoupled from wall-clock via an accumulator; speed multiplier applies uniformly.
 */
export class SimulationTimeEngine {
    /** @type {number} current simulation time in ms since epoch */
    #simTimeMs;
    /** @type {number} wall-clock ms at last tick */
    #lastWallMs;
    /** @type {number} speed multiplier (0 = paused, negative = rewind) */
    #speedMultiplier;
    /** @type {boolean} */
    #running;
    /** @type {Set<(simTimeMs: number, deltaMs: number) => void>} */
    #subscribers;

    constructor(startTimeMs = Date.now()) {
        this.#simTimeMs       = startTimeMs;
        this.#lastWallMs      = performance.now();
        this.#speedMultiplier = TimeSpeed.REAL;
        this.#running         = false;
        this.#subscribers     = new Set();
    }

    get simTimeMs()       { return this.#simTimeMs; }
    get speedMultiplier() { return this.#speedMultiplier; }
    get isPaused()        { return this.#speedMultiplier === TimeSpeed.PAUSED; }

    get simDate() { return new Date(this.#simTimeMs); }

    start() {
        if (this.#running) return;
        this.#running    = true;
        this.#lastWallMs = performance.now();
    }

    pause() {
        this.#speedMultiplier = TimeSpeed.PAUSED;
    }

    play(speed = TimeSpeed.REAL) {
        this.#speedMultiplier = speed;
        if (!this.#running) this.start();
    }

    setSpeed(multiplier) {
        this.#speedMultiplier = multiplier;
    }

    setSimTime(ms) {
        this.#simTimeMs = ms;
        this.#notify(0);
    }

    /** Call once per animation frame with current performance.now() */
    tick(wallMs = performance.now()) {
        if (!this.#running) return;
        const wallDeltaMs = wallMs - this.#lastWallMs;
        this.#lastWallMs  = wallMs;

        if (this.#speedMultiplier === TimeSpeed.PAUSED) return;

        const simDeltaMs  = wallDeltaMs * this.#speedMultiplier;
        this.#simTimeMs  += simDeltaMs;

        this.#notify(simDeltaMs);
    }

    #notify(deltaMs) {
        for (const fn of this.#subscribers) {
            fn(this.#simTimeMs, deltaMs);
        }
    }

    subscribe(fn) {
        this.#subscribers.add(fn);
        return () => this.#subscribers.delete(fn);
    }

    dispose() {
        this.#subscribers.clear();
        this.#running = false;
    }
}
