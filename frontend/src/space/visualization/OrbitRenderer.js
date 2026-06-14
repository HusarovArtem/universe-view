import * as THREE from 'three';
import { KeplerPropagator } from '../orbit/KeplerPropagator.js';
import { SatelliteCategory } from '../objects/satellite/Satellite.js';

const ORBIT_COLORS = {
    [SatelliteCategory.ISS]:      0x00ffe0,
    [SatelliteCategory.STARLINK]: 0x1133aa,
    [SatelliteCategory.ACTIVE]:   0x664400,
    [SatelliteCategory.GPS]:      0x335511,
    default:                       0x333355,
};

const ORBIT_STEPS       = 128;
const MAX_ORBIT_LINES   = 200;

/**
 * Manages orbit path line objects.
 * Decoupled from propagation — only reads orbital elements + time.
 */
export class OrbitRenderer {
    /** @type {THREE.Object3D} */
    #parent;
    /** @type {Map<string, THREE.Line>} sat id → line */
    #lines = new Map();
    /** @type {boolean} */
    #visible = true;
    /** @type {Set<string>} currently displayed satellite ids */
    #activeIds = new Set();

    constructor(parent) {
        this.#parent = parent;
    }

    /**
     * Show orbit for a specific satellite.
     * @param {import('../objects/satellite/Satellite.js').Satellite} sat
     * @param {number} simTimeMs
     */
    showOrbit(sat, simTimeMs) {
        if (!sat.orbitalElements) return;
        if (this.#lines.has(sat.id)) this.#removeOrbit(sat.id);

        const pts   = KeplerPropagator.orbitPath(sat.orbitalElements, simTimeMs, ORBIT_STEPS);
        const geo   = new THREE.BufferGeometry().setFromPoints(pts);
        const color = ORBIT_COLORS[sat.category] ?? ORBIT_COLORS.default;
        const mat   = new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: sat.category === SatelliteCategory.ISS ? 0.9 : 0.35,
            depthWrite: false,
        });

        const line  = new THREE.Line(geo, mat);
        line.name   = `Orbit_${sat.id}`;
        line.visible = this.#visible;

        this.#parent.add(line);
        this.#lines.set(sat.id, line);
        this.#activeIds.add(sat.id);
    }

    hideOrbit(satId) {
        this.#removeOrbit(satId);
        this.#activeIds.delete(satId);
    }

    /**
     * Redraw all active orbits at new sim time (call when time jumps).
     * @param {Map<string, import('../objects/satellite/Satellite.js').Satellite>} satellites
     * @param {number} simTimeMs
     */
    refreshAll(satellites, simTimeMs) {
        for (const id of this.#activeIds) {
            const sat = satellites.get(id);
            if (sat) this.showOrbit(sat, simTimeMs);
        }
    }

    setAllVisible(visible) {
        this.#visible = visible;
        for (const line of this.#lines.values()) {
            line.visible = visible;
        }
    }

    #removeOrbit(id) {
        const line = this.#lines.get(id);
        if (!line) return;
        line.geometry.dispose();
        line.material.dispose();
        this.#parent.remove(line);
        this.#lines.delete(id);
    }

    dispose() {
        for (const id of [...this.#lines.keys()]) this.#removeOrbit(id);
        this.#activeIds.clear();
    }
}
