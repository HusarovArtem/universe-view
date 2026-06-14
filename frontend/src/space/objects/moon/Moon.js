/**
 * Moon.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Physically-based Moon implementation for the Universe View scene.
 *
 * Architecture
 * ────────────
 * Follows the same factory pattern as Earth.js:
 *   - createMoon(timeEngine)  → returns a THREE.Group ("Moon")
 *   - updateMoon(group, simTimeMs)  → drives position + rotation each tick
 *   - disposeMoon(group)  → frees GPU resources
 *
 * The group is added directly to the THREE.Scene (NOT parented under Earth).
 * This is architecturally critical: parenting under Earth would mean camera
 * rotations / Earth spin affect the Moon's world position. The Moon's position
 * is driven purely by LunarOrbit.computeLunarState(), which is Earth-centred
 * (ECI) but scene-rooted, matching how satellite positions work.
 *
 * Tidal Locking
 * ─────────────
 * The Moon always keeps the same face toward Earth because its spin period
 * equals its orbital period. We implement this by:
 *   1. Deriving the argument of latitude u = ω + ν from the orbital state
 *   2. Setting mesh.rotation.y = u directly each frame
 *   3. Adding a 90° offset so the "near side" faces the correct direction
 *      (the texture is oriented with Mare Tranquillitatis toward −Z by default)
 *
 * Because u is derived from the same Kepler solution as the position, the
 * face-toward-Earth property holds exactly at any time scale with zero drift.
 *
 * Sun Illumination & Phases
 * ─────────────────────────
 * Phases are NOT faked with textures. The directional sunLight from main.js
 * illuminates the Moon's MeshStandardMaterial normally. At any configuration
 * of Sun–Earth–Moon the correct crescent/gibbous/full geometry shadow will be
 * cast automatically by Three.js's Phong/PBR shading pipeline. No custom
 * shader is needed because the Moon is a Lambertian sphere.
 *
 * Earthshine
 * ──────────
 * A faint emissive value is set on the material to simulate Earthshine — the
 * reflected glow from Earth that faintly illuminates the Moon's dark side.
 * This is kept very subtle (emissiveIntensity ~ 0.04) to be physically
 * plausible. In reality Earthshine has a blue-grey hue from Earth's oceans.
 *
 * Extensibility
 * ─────────────
 * This module intentionally does NOT extend a CelestialBody base class yet,
 * because there is only one such body right now. When a second body (e.g. Mars)
 * is added, the shared pattern should be extracted into:
 *   src/space/objects/celestial/CelestialBody.js
 * See the companion abstract CelestialBody.js file that documents the proposed
 * interface for that future extraction.
 *
 * Performance Notes
 * ─────────────────
 * • LunarOrbit.computeLunarState() reuses a pooled result object — no
 *   allocations per frame.
 * • eciToScene() writes into a pre-allocated Vector3 inside this module.
 * • The texture load is asynchronous; the Moon renders with a grey fallback
 *   colour immediately and upgrades when the texture arrives.
 * • SphereGeometry with 64 segments ≈ 8 KB index buffer; negligible cost.
 */

import * as THREE from 'three';
import { computeLunarState, eciToScene } from './LunarOrbit.js';
import {
    MOON_RADIUS_SCENE,
    MOON_GEOMETRY_SEGMENTS,
    MOON_ROUGHNESS,
    MOON_METALNESS,
    MOON_EARTHSHINE_COLOR,
    MOON_EARTHSHINE_INTENSITY,
} from './LunarConstants.js';

// ─── Module-level scratch objects (zero per-frame allocation) ─────────────────
const _scenePos = new THREE.Vector3();

// ─── Texture URL ─────────────────────────────────────────────────────────────
// We use the NASA CGI Moon Kit 2K texture hosted on Three.js CDN.
// It is an equirectangular map, seamlessly UV-wrapped by Three.js's default
// SphereGeometry UV layout.
const MOON_TEXTURE_URL =
    'https://threejs.org/examples/textures/planets/moon_1024.jpg';

/**
 * Creates and returns the Moon THREE.Group, wired to the given timeEngine.
 *
 * The returned group should be added to the scene root (not to Earth):
 *   scene.add(moon);
 *
 * An internal subscription to timeEngine is created automatically.
 * Call disposeMoon(group) to release it.
 *
 * @param {import('../../time/SimulationTimeEngine.js').SimulationTimeEngine} timeEngine
 * @returns {THREE.Group}
 */
export function createMoon(timeEngine) {
    const group = new THREE.Group();
    group.name = 'Moon';

    // ── Geometry ──────────────────────────────────────────────────────────────
    // High-segment sphere for smooth silhouette; normals are vertex-interpolated
    // so lighting is smooth regardless of actual poly count.
    const geometry = new THREE.SphereGeometry(
        MOON_RADIUS_SCENE,
        MOON_GEOMETRY_SEGMENTS,
        MOON_GEOMETRY_SEGMENTS,
    );

    // ── Material ──────────────────────────────────────────────────────────────
    // MeshStandardMaterial (PBR) is used instead of MeshPhongMaterial because:
    //   1. roughness/metalness gives physically correct shading for a rocky body
    //   2. emissive works correctly with PBR (Earthshine)
    //   3. it responds naturally to the scene's DirectionalLight (sun phases)
    //
    // Fallback: grey colour (#888) renders immediately while the texture loads.
    const material = new THREE.MeshStandardMaterial({
        color:             0x888888,   // fallback until texture loads
        roughness:         MOON_ROUGHNESS,
        metalness:         MOON_METALNESS,
        emissive:          new THREE.Color(MOON_EARTHSHINE_COLOR),
        emissiveIntensity: MOON_EARTHSHINE_INTENSITY,
    });

    // Load the texture asynchronously — the Moon renders with fallback colour
    // until it arrives.
    const loader = new THREE.TextureLoader();
    loader.load(
        MOON_TEXTURE_URL,
        (texture) => {
            // Encoding hint for Three.js r152+: sRGB for colour textures
            texture.colorSpace = THREE.SRGBColorSpace;
            material.map   = texture;
            material.color.setHex(0xffffff); // let texture drive colour
            material.needsUpdate = true;
        },
        undefined,
        (err) => {
            console.warn('[Moon] Texture load failed, using fallback colour:', err);
        },
    );

    // ── Mesh ──────────────────────────────────────────────────────────────────
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name          = 'MoonSurface';
    mesh.castShadow    = true;
    mesh.receiveShadow = true;

    // Tidal lock initial orientation:
    // Rotate so the texture "near side" faces −Z (toward the camera's default
    // viewpoint which looks along −Z). This is purely a texture-orientation
    // correction; the actual tidal-lock logic is applied every frame.
    mesh.rotation.y = Math.PI;

    group.add(mesh);

    // ── Initial position ──────────────────────────────────────────────────────
    // Compute position immediately at current sim time so the Moon appears at
    // the correct location before the first tick() fires.
    _applyLunarState(group, timeEngine.simTimeMs);

    // ── Subscribe to simulation time ──────────────────────────────────────────
    // The unsubscribe handle is stored on the group's userData so disposeMoon()
    // can clean it up without needing a separate reference.
    const unsubscribe = timeEngine.subscribe((simTimeMs) => {
        _applyLunarState(group, simTimeMs);
    });

    group.userData.dispose = () => {
        unsubscribe();
        geometry.dispose();
        material.dispose();
        if (material.map) material.map.dispose();
    };

    return group;
}

/**
 * Manually re-positions the Moon at the given simulation time.
 * Useful when the time engine jumps (e.g. setSimTime) without going through
 * subscribe — though in practice the subscription handles this.
 *
 * @param {THREE.Group}  moonGroup
 * @param {number}       simTimeMs
 */
export function updateMoon(moonGroup, simTimeMs) {
    _applyLunarState(moonGroup, simTimeMs);
}

/**
 * Releases all GPU resources held by the Moon group and unsubscribes from
 * the time engine.
 *
 * @param {THREE.Group} moonGroup
 */
export function disposeMoon(moonGroup) {
    if (typeof moonGroup.userData.dispose === 'function') {
        moonGroup.userData.dispose();
    }
}

// ─── Private ─────────────────────────────────────────────────────────────────

/**
 * Core per-frame update:
 *   1. Propagate orbital state for simTimeMs
 *   2. Convert ECI position → scene position
 *   3. Set group.position (moves the whole Moon group in the scene)
 *   4. Apply tidal-lock rotation to the inner mesh
 *
 * @param {THREE.Group} moonGroup
 * @param {number}      simTimeMs
 */
function _applyLunarState(moonGroup, simTimeMs) {
    // Step 1–2: propagate & convert to scene space
    const state = computeLunarState(simTimeMs);
    eciToScene(state.positionKm, _scenePos);

    // Step 3: set the group's world position
    moonGroup.position.copy(_scenePos);

    // Step 4: tidal-lock rotation
    // The mesh is rotated so that its local −Z axis always points toward the
    // scene origin (Earth). We achieve this by aligning the mesh's rotation.y
    // with the argument of latitude u = ω + ν.
    //
    // Why rotation.y?
    //   In the scene frame, the Moon orbits roughly in the XZ plane (ecliptic).
    //   Y-axis rotation sweeps the mesh around its polar axis, which is the
    //   tidal-lock degree of freedom.
    //
    // Sign convention:
    //   orbitalAngle increases CCW when viewed from +Y (ecliptic north).
    //   A positive rotation.y in Three.js is also CCW from +Y.
    //   Therefore rotation.y = orbitalAngle keeps the same face pointing
    //   along the orbit radius vector — exactly tidal locking.
    //
    // The extra Math.PI offset is the texture-orientation correction applied
    // at creation time via mesh.rotation.y = Math.PI. Because we assign
    // rotation.y directly each frame, we must include it here.
    const mesh = moonGroup.getObjectByName('MoonSurface');
    if (mesh) {
        // We need the Moon's near-side to face Earth (scene origin).
        // The rotation that points local -Z toward origin is:
        //   rotation.y = orbitalAngle + π
        // because the mesh was initialised with rotation.y = π.
        mesh.rotation.y = state.orbitalAngle + Math.PI;
    }
}
