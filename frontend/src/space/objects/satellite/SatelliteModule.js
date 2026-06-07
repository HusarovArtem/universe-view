import { CelesTrakProvider, SatelliteProviderRegistry } from './SatelliteProvider.js';
import { KeplerPropagator } from '../../orbit/KeplerPropagator.js';

export class SatelliteModule {
    #satellites  = new Map();
    #registry;
    #timeEngine;
    #unsubscribe = null;
    #onUpdate    = new Set();

    constructor(timeEngine) {
        this.#timeEngine = timeEngine;
        this.#registry   = new SatelliteProviderRegistry();
        this.#registry.register('celestrak', new CelesTrakProvider());
    }

    get satellites() { return this.#satellites; }
    get count()      { return this.#satellites.size; }

    async load(group = 'active', providerName = 'celestrak') {
        const provider = this.#registry.get(providerName);
        let sats;

        switch (group) {
            case 'iss':      sats = await provider.fetchISS();      break;
            case 'starlink': sats = await provider.fetchStarlink(); break;
            default:         sats = await provider.fetchActive();
        }

        this.#satellites.clear();
        for (const sat of sats) {
            this.#satellites.set(sat.id, sat);
        }

        this.#propagateAll(this.#timeEngine.simTimeMs);
        this.#notifyUpdate();
        this.#startTracking();
        return sats.length;
    }

    #startTracking() {
        if (this.#unsubscribe) this.#unsubscribe();
        this.#unsubscribe = this.#timeEngine.subscribe((simTimeMs) => {
            if (this.#satellites.size === 0) return;
            this.#propagateAll(simTimeMs);
            this.#notifyUpdate();
        });
    }

    #propagateAll(simTimeMs) {
        for (const sat of this.#satellites.values()) {
            if (!sat.orbitalElements) continue;
            const pos      = KeplerPropagator.propagate(sat.orbitalElements, simTimeMs);
            const scenePos = KeplerPropagator.eciToScene(pos);
            sat.position   = { x: scenePos.x, y: scenePos.y, z: scenePos.z };
            sat.altitudeKm = pos.altKm;
        }
    }

    onUpdate(fn) {
        this.#onUpdate.add(fn);
        return () => this.#onUpdate.delete(fn);
    }

    #notifyUpdate() {
        for (const fn of this.#onUpdate) fn(this.#satellites);
    }

    getById(id) { return this.#satellites.get(id) ?? null; }

    dispose() {
        if (this.#unsubscribe) this.#unsubscribe();
        this.#satellites.clear();
        this.#onUpdate.clear();
    }
}
