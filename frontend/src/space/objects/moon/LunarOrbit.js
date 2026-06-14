/**
 * LunarOrbit.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure orbital-mechanics module for the Moon.
 *
 * Returns THREE.Vector3 positions in scene space — identical coordinate
 * convention to KeplerPropagator.eciToScene():
 *
 *   scene.x =  eciX * SCENE_SCALE
 *   scene.y =  eciZ * SCENE_SCALE   (ECI Z is ecliptic/celestial north → scene +Y)
 *   scene.z = -eciY * SCENE_SCALE   (right-hand → left-hand flip)
 *
 * Why a dedicated propagator rather than reusing KeplerPropagator?
 * ──────────────────────────────────────────────────────────────────
 * KeplerPropagator works from TLE-derived OrbitalElements keyed to a TLE epoch
 * and uses mean motion (rev/day) from the TLE.  The Moon's orbit is referenced
 * to J2000 with standard Keplerian elements, and we want precise eccentricity
 * handling.  Sharing code is tempting but would couple the satellite propagator
 * to the celestial-body domain.  Separating them preserves the Single
 * Responsibility Principle and lets each evolve independently.
 *
 * Orbital model used: classical two-body Kepler with:
 *   - Eccentric-anomaly Newton iteration (same algorithm as KeplerPropagator)
 *   - Full 3-D rotation through (Ω, i, ω) Euler angles
 *   - Argument-of-perigee precession approximation (~0.111°/day)
 *   - Node regression omitted (< 20° error over 1 year; acceptable for visuals)
 *
 * For higher accuracy (eclipse prediction, tidal forces) replace with an
 * ELP/MPP02 or VSOP87 implementation.
 */

import * as THREE from 'three';
import {
    VISUAL_MOON_SMA_KM,
    MOON_ECCENTRICITY,
    MOON_INCLINATION_RAD,
    MOON_RAAN_RAD_J2000,
    MOON_ARG_PERIGEE_RAD_J2000,
    MOON_MEAN_ANOMALY_RAD_J2000,
    MOON_MEAN_ANGULAR_VELOCITY_RAD_MS,
    J2000_EPOCH_MS,
    SCENE_SCALE,
} from './LunarConstants.js';

// ─── Internal constants ───────────────────────────────────────────────────────

const TWO_PI = Math.PI * 2;

/**
 * Argument-of-perigee precession rate for the Moon (rad / ms).
 * Real value: ~0.111404°/day.
 * This is the "anomalistic" vs "sidereal" period difference.
 * Including it gives a slowly shifting perigee direction, which is
 * physically correct and adds subtle visual interest over long time spans.
 */
const ARG_PERIGEE_PRECESSION_RAD_MS = (0.111404 * (Math.PI / 180)) / 86_400_000;

// ─── Result object pool — avoids allocation pressure in the animation loop ───
const _result = { positionKm: new THREE.Vector3(), orbitalAngle: 0 };

// ─── Scratch vectors for ECI computation (no per-frame allocation) ────────────
const _pqVec  = new THREE.Vector3(); // position in perifocal (PQW) frame
const _eciVec = new THREE.Vector3(); // position in ECI frame

/**
 * @typedef {Object} LunarState
 * @property {THREE.Vector3} positionKm   - ECI position (km). Do NOT mutate.
 * @property {number}        orbitalAngle - True anomaly + arg perigee (rad),
 *                                          used for tidal-lock rotation.
 */

/**
 * Computes the Moon's ECI position at the given simulation time.
 *
 * Algorithm:
 *   1. Compute elapsed time from J2000 epoch
 *   2. Advance mean anomaly by mean motion × Δt
 *   3. Include linear argument-of-perigee precession
 *   4. Solve Kepler's equation for eccentric anomaly E via Newton–Raphson
 *   5. Convert E → true anomaly ν
 *   6. Compute distance r from vis-viva (r = a(1 - e·cosE))
 *   7. Build perifocal position vector (P, Q, W frame)
 *   8. Rotate through ω (arg perigee), i (inclination), Ω (RAAN) to ECI
 *
 * @param {number} simTimeMs - Simulation time as Unix timestamp (ms)
 * @returns {LunarState}     - Reused object; copy values if you need to store them
 */
export function computeLunarState(simTimeMs) {
    // 1. Time from J2000 (ms)
    const dtMs = simTimeMs - J2000_EPOCH_MS;

    // 2. Mean anomaly at this time (radians)
    //    M = M₀ + n·Δt
    const M = wrapTwoPi(MOON_MEAN_ANOMALY_RAD_J2000 + MOON_MEAN_ANGULAR_VELOCITY_RAD_MS * dtMs);

    // 3. Argument of perigee with precession
    //    ω = ω₀ + ω̇·Δt
    const omega = wrapTwoPi(MOON_ARG_PERIGEE_RAD_J2000 + ARG_PERIGEE_PRECESSION_RAD_MS * dtMs);

    // 4. Solve Kepler's equation: M = E − e·sin(E)  →  Newton–Raphson
    const E = solveKepler(M, MOON_ECCENTRICITY);

    // 5. True anomaly ν from eccentric anomaly E
    //    tan(ν/2) = sqrt((1+e)/(1-e)) · tan(E/2)
    const nu = 2.0 * Math.atan2(
        Math.sqrt(1.0 + MOON_ECCENTRICITY) * Math.sin(E * 0.5),
        Math.sqrt(1.0 - MOON_ECCENTRICITY) * Math.cos(E * 0.5),
    );

    // 6. Orbital radius (km) — uses visual SMA for comfortable on-screen distance
    const r = VISUAL_MOON_SMA_KM * (1.0 - MOON_ECCENTRICITY * Math.cos(E));

    // 7. Perifocal frame position
    //    x_pqw = r·cos(ν)
    //    y_pqw = r·sin(ν)
    //    z_pqw = 0 (in orbital plane)
    const cosNu = Math.cos(nu);
    const sinNu = Math.sin(nu);
    _pqVec.set(r * cosNu, r * sinNu, 0);

    // 8. Rotate perifocal → ECI via the standard Euler sequence R3(−Ω) R1(−i) R3(−ω)
    //    Combined analytically for zero-allocation performance.
    eciFromPerifocal(_pqVec, omega, MOON_INCLINATION_RAD, MOON_RAAN_RAD_J2000, _eciVec);

    _result.positionKm.copy(_eciVec);
    // orbitalAngle used by the tidal-lock rotation: argument of latitude u = ω + ν
    _result.orbitalAngle = wrapTwoPi(omega + nu);

    return _result;
}

/**
 * Converts a LunarState ECI position (km) into scene-space THREE.Vector3.
 *
 * Scene convention (matching KeplerPropagator.eciToScene):
 *   scene.x =  eci.x * SCENE_SCALE
 *   scene.y =  eci.z * SCENE_SCALE   (ecliptic north → scene up)
 *   scene.z = -eci.y * SCENE_SCALE   (right-hand flip)
 *
 * @param {THREE.Vector3} eciKm      - ECI position in km
 * @param {THREE.Vector3} [out]      - Optional pre-allocated output vector
 * @returns {THREE.Vector3}
 */
export function eciToScene(eciKm, out = new THREE.Vector3()) {
    out.set(
         eciKm.x * SCENE_SCALE,
         eciKm.z * SCENE_SCALE,
        -eciKm.y * SCENE_SCALE,
    );
    return out;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Solve Kepler's equation M = E - e·sin(E) by Newton-Raphson iteration.
 * Converges in ≤ 6 iterations for eccentricity < 0.3.
 *
 * @param {number} M - Mean anomaly (radians)
 * @param {number} e - Eccentricity
 * @param {number} [tol=1e-10] - Convergence tolerance (radians)
 * @returns {number} Eccentric anomaly E (radians)
 */
function solveKepler(M, e, tol = 1e-10) {
    // Initial guess: E₀ = M + e·sin(M)·(1 + e·cos(M)) (Meeus approximation)
    let E = M + e * Math.sin(M) * (1.0 + e * Math.cos(M));

    for (let i = 0; i < 50; i++) {
        const sinE = Math.sin(E);
        const cosE = Math.cos(E);
        const dE   = (M - E + e * sinE) / (1.0 - e * cosE);
        E += dE;
        if (Math.abs(dE) < tol) break;
    }

    return E;
}

/**
 * Rotate a perifocal position vector into ECI coordinates.
 *
 * The rotation matrix is R = R3(−Ω) · R1(−i) · R3(−ω)
 * Applied analytically:
 *
 *   x_eci = x_pq·(cos Ω cos ω − sin Ω sin ω cos i) − y_pq·(cos Ω sin ω + sin Ω cos ω cos i)
 *   y_eci = x_pq·(sin Ω cos ω + cos Ω sin ω cos i) − y_pq·(sin Ω sin ω − cos Ω cos ω cos i)
 *   z_eci = x_pq·(sin ω sin i) + y_pq·(cos ω sin i)
 *
 * This avoids THREE.Matrix4 allocation inside the animation loop.
 *
 * @param {THREE.Vector3} pq    - Perifocal position (x_pq, y_pq, 0)
 * @param {number}        omega - Argument of perigee (rad)
 * @param {number}        inc   - Inclination (rad)
 * @param {number}        raan  - Right ascension of ascending node (rad)
 * @param {THREE.Vector3} out   - Output vector
 */
function eciFromPerifocal(pq, omega, inc, raan, out) {
    const cosO = Math.cos(raan);
    const sinO = Math.sin(raan);
    const cosW = Math.cos(omega);
    const sinW = Math.sin(omega);
    const cosI = Math.cos(inc);
    const sinI = Math.sin(inc);

    const xpq = pq.x;
    const ypq = pq.y;

    // Row 1
    const m00 =  cosO * cosW - sinO * sinW * cosI;
    const m01 = -cosO * sinW - sinO * cosW * cosI;
    // Row 2
    const m10 =  sinO * cosW + cosO * sinW * cosI;
    const m11 = -sinO * sinW + cosO * cosW * cosI;
    // Row 3
    const m20 =  sinW * sinI;
    const m21 =  cosW * sinI;

    out.set(
        xpq * m00 + ypq * m01,
        xpq * m10 + ypq * m11,
        xpq * m20 + ypq * m21,
    );
}

/** Wrap angle to [0, 2π) */
function wrapTwoPi(angle) {
    return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
}
