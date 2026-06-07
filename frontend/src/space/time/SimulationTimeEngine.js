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

export class SimulationTimeEngine {
    #simTimeMs;
    #lastWallMs;
    #speedMultiplier;
    #running;
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
    get simDate()         { return new Date(this.#simTimeMs); }

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
        if (multiplier !== TimeSpeed.PAUSED && !this.#running) this.start();
    }

    setSimTime(ms) {
        this.#simTimeMs = ms;
        this.#notify(0);
    }

    tick(wallMs = performance.now()) {
        if (!this.#running) return;

        const wallDeltaMs = wallMs - this.#lastWallMs;
        this.#lastWallMs  = wallMs;

        // Always advance lastWallMs, but only notify when actually moving
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
