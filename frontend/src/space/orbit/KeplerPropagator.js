import * as THREE from 'three';

const TWO_PI          = Math.PI * 2;
const DEG2RAD         = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;
const SCENE_SCALE     = 5 / EARTH_RADIUS_KM; // scene units per km

/**
 * Analytical Keplerian propagator (not full SGP4 — sufficient for visualization).
 * For production orbital mechanics accuracy, replace with a WASM SGP4 or backend call.
 */
export class KeplerPropagator {
    /**
     * Compute satellite ECI position (km) at given time.
     * @param {OrbitalElements} elements
     * @param {number} simTimeMs
     * @returns {{ x: number, y: number, z: number, altKm: number }}
     */
    static propagate(elements, simTimeMs) {
        const dtSec       = (simTimeMs - elements.epochMs) / 1000;
        const n           = elements.meanMotion * TWO_PI / 86400;
        const M           = (elements.meanAnomalyDeg * DEG2RAD + n * dtSec) % TWO_PI;
        const E           = KeplerPropagator.#solveKepler(M, elements.eccentricity);

        const nu          = 2 * Math.atan2(
            Math.sqrt(1 + elements.eccentricity) * Math.sin(E / 2),
            Math.sqrt(1 - elements.eccentricity) * Math.cos(E / 2),
        );

        const r           = elements.semiMajorAxisKm * (1 - elements.eccentricity * Math.cos(E));

        const i   = elements.inclinationDeg  * DEG2RAD;
        const om  = elements.raanDeg          * DEG2RAD;
        const w   = elements.argPerigeeDeg    * DEG2RAD;
        const u   = nu + w;

        const x = r * (Math.cos(om) * Math.cos(u) - Math.sin(om) * Math.sin(u) * Math.cos(i));
        const y = r * (Math.sin(om) * Math.cos(u) + Math.cos(om) * Math.sin(u) * Math.cos(i));
        const z = r * Math.sin(u) * Math.sin(i);

        return { x, y, z, altKm: r - EARTH_RADIUS_KM };
    }

    /**
     * Compute a set of orbit path points in scene coordinates.
     * @param {OrbitalElements} elements
     * @param {number} simTimeMs
     * @param {number} steps
     * @returns {THREE.Vector3[]}
     */
    static orbitPath(elements, simTimeMs, steps = 128) {
        const periodMs = elements.getPeriodMs();
        const pts      = [];

        for (let i = 0; i <= steps; i++) {
            const t   = simTimeMs + (i / steps) * periodMs;
            const pos = KeplerPropagator.propagate(elements, t);
            pts.push(KeplerPropagator.eciToScene(pos));
        }

        return pts;
    }

    static eciToScene({ x, y, z }) {
        return new THREE.Vector3(
            x * SCENE_SCALE,
            z * SCENE_SCALE,
            -y * SCENE_SCALE,
        );
    }

    static #solveKepler(M, e, tol = 1e-8) {
        let E = M;
        for (let i = 0; i < 50; i++) {
            const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
            E += dE;
            if (Math.abs(dE) < tol) break;
        }
        return E;
    }
}

export { SCENE_SCALE, EARTH_RADIUS_KM };
