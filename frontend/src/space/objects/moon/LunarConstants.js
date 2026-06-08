/**
 * LunarConstants.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for every physical, orbital, and rendering constant
 * related to the Moon. No magic numbers anywhere else in the lunar subsystem.
 *
 * All physical values are IAU/JPL standard unless noted.
 * Scaling law: scene units = km × SCENE_SCALE, where SCENE_SCALE = 5 / 6371
 * (Earth radius = 5 scene units, Earth real radius = 6371 km).
 *
 * Architectural decision: keeping constants in a dedicated module (rather than
 * embedding them in Moon.js) lets future bodies (Mars, Venus, etc.) import the
 * same SCENE_SCALE without creating circular dependencies on the Earth module.
 */

import { SCENE_SCALE, EARTH_RADIUS_KM } from '../../orbit/KeplerPropagator.js';

// ─── Physical: Earth ─────────────────────────────────────────────────────────

/** Earth's gravitational parameter μ = GM  (km³ s⁻²) */
export const EARTH_MU_KM3_S2 = 398600.4418;

// ─── Physical: Moon ──────────────────────────────────────────────────────────

/** Mean radius of the Moon (km) — IAU 2015 */
export const MOON_RADIUS_KM = 1737.4;

/**
 * Moon radius in scene units, derived from the same SCENE_SCALE used by Earth.
 * Do NOT override this with an aesthetic value — the correct proportion matters
 * for simulating phase angles and for distance perception.
 */
export const MOON_RADIUS_SCENE = MOON_RADIUS_KM * SCENE_SCALE;

// ─── Orbital Elements (J2000 epoch, mean values) ─────────────────────────────
// Source: Meeus "Astronomical Algorithms" 2nd ed., Chapter 47 & 53;
// and JPL Horizons System mean orbital elements for the Moon.

/** Semi-major axis of the lunar orbit (km) */
export const MOON_SMA_KM = 384_400;

/** Semi-major axis in scene units */
export const MOON_SMA_SCENE = MOON_SMA_KM * SCENE_SCALE;

/** Orbital eccentricity — causes visible variation in apparent size */
export const MOON_ECCENTRICITY = 0.0549;

/**
 * Inclination to the ecliptic (degrees).
 * The Moon's orbit is inclined ~5.145° to the ecliptic, not to Earth's equator.
 * For a scene whose "up" is +Y and whose ecliptic lies in the XZ plane, this
 * tilt rotates the orbital plane slightly above/below the ecliptic.
 */
export const MOON_INCLINATION_DEG = 5.145;
export const MOON_INCLINATION_RAD = MOON_INCLINATION_DEG * (Math.PI / 180);

/**
 * Sidereal orbital period (days).
 * This is the period relative to fixed stars (not synodic/phase cycle).
 * Sidereal = 27.321661 d.  Synodic (new moon → new moon) = 29.530589 d.
 * We use sidereal for position calculation; phases emerge from geometry.
 */
export const MOON_PERIOD_DAYS    = 27.321661;
export const MOON_PERIOD_SECONDS = MOON_PERIOD_DAYS * 86_400;
export const MOON_PERIOD_MS      = MOON_PERIOD_SECONDS * 1_000;

/**
 * Mean angular velocity (radians per millisecond).
 * Derived from sidereal period. Positive = counter-clockwise when viewed
 * from ecliptic north (+Y in scene).
 *
 * Formula: ω = 2π / T_ms
 */
export const MOON_MEAN_ANGULAR_VELOCITY_RAD_MS = (2 * Math.PI) / MOON_PERIOD_MS;

/**
 * Longitude of the ascending node at J2000 (degrees).
 * The node regresses ~19.35°/year due to solar perturbation; we approximate
 * with a fixed value at epoch for visualization purposes.
 * Full node regression would require an ELP/MPP02 ephemeris.
 */
export const MOON_RAAN_DEG_J2000 = 125.1228;
export const MOON_RAAN_RAD_J2000 = MOON_RAAN_DEG_J2000 * (Math.PI / 180);

/**
 * Argument of perigee at J2000 (degrees).
 * The perigee rotates ~0.111°/day; we use a fixed value at epoch.
 */
export const MOON_ARG_PERIGEE_DEG_J2000 = 318.0634;
export const MOON_ARG_PERIGEE_RAD_J2000 = MOON_ARG_PERIGEE_DEG_J2000 * (Math.PI / 180);

/**
 * Mean anomaly at J2000 (degrees).
 * From Meeus Table 47.a, the Moon's mean anomaly at J2000.0 is 134.9634°.
 */
export const MOON_MEAN_ANOMALY_DEG_J2000 = 134.9634;
export const MOON_MEAN_ANOMALY_RAD_J2000 = MOON_MEAN_ANOMALY_DEG_J2000 * (Math.PI / 180);

// ─── Epoch ────────────────────────────────────────────────────────────────────

/**
 * J2000.0 reference epoch as Unix timestamp (ms).
 * J2000.0 = 2000-01-01 12:00:00 TT ≈ 2000-01-01 11:58:55.816 UTC.
 * We use the UTC approximation (< 2 second error) which is acceptable for
 * visualization purposes.
 */
export const J2000_EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0);

// ─── Tidal-Locking ───────────────────────────────────────────────────────────

/**
 * The Moon is tidally locked: its rotation period equals its orbital period.
 * Therefore the rotation rate (rad/ms) is identical to MOON_MEAN_ANGULAR_VELOCITY_RAD_MS.
 * Maintained as a separate constant for clarity and to make the physical
 * relationship explicit in code.
 *
 * Implementation note: we synchronize rotation with orbital angle rather than
 * integrating separately, so floating-point drift cannot decouple them.
 */
export const MOON_ROTATION_RATE_RAD_MS = MOON_MEAN_ANGULAR_VELOCITY_RAD_MS;

// ─── Visual / Material ───────────────────────────────────────────────────────

/**
 * Geometry tessellation. 64×64 provides smooth silhouette + enough normal
 * variation for shading detail without GPU overhead.
 * 96×96 for hi-DPI displays where you'd see the facets otherwise.
 */
export const MOON_GEOMETRY_SEGMENTS = 64;

/**
 * Earthshine: faint blue-grey glow on the dark hemisphere.
 * The real albedo of Earthshine-lit lunar terrain is ~0.12 of the full moon.
 * We represent it as a very low emissive intensity so it is subtly visible
 * without washing out the shadow.
 */
export const MOON_EARTHSHINE_COLOR      = 0x334466;
export const MOON_EARTHSHINE_INTENSITY  = 0.04;   // keeps it subtle

/** Surface roughness — drives specular softness in MeshStandardMaterial */
export const MOON_ROUGHNESS = 0.92;
export const MOON_METALNESS = 0.0;

// ─── Re-export scene scale so callers don't need two imports ─────────────────
export { SCENE_SCALE, EARTH_RADIUS_KM };
