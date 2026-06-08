/**
 * CelestialBody.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Abstract base class / interface definition for natural celestial bodies
 * (planets, moons, asteroids, comets).
 *
 * Current status: DESIGN DOCUMENT + FUTURE BASE CLASS
 * ────────────────────────────────────────────────────
 * Moon.js does NOT yet extend this class because there is only one celestial
 * body implementation. Premature inheritance creates coupling with no benefit.
 * When the second body (Mars, Venus, Sun, etc.) is implemented, this class
 * should be made the parent and Moon.js refactored to extend it.
 *
 * Proposed usage:
 *
 *   import { CelestialBody } from '../celestial/CelestialBody.js';
 *
 *   export class Moon extends CelestialBody {
 *       constructor(timeEngine) { super('Moon', timeEngine); }
 *
 *       _computeState(simTimeMs) {
 *           // return { scenePosition: THREE.Vector3, selfRotation: THREE.Euler }
 *       }
 *
 *       _buildMesh() {
 *           // return THREE.Mesh
 *       }
 *   }
 *
 * Why factory functions over classes in the current Moon implementation?
 * ──────────────────────────────────────────────────────────────────────
 * Earth.js uses factory functions (createEarth). Following the same pattern
 * keeps the codebase consistent. Classes will be introduced when shared
 * behaviour (lifecycle, subscription management, dispose pattern) justifies
 * the abstraction — i.e., when there are ≥ 2 concrete implementations.
 *
 * Registry Pattern (for future use)
 * ──────────────────────────────────
 * When multiple bodies exist, a CelestialBodyRegistry can track them:
 *
 *   const registry = new CelestialBodyRegistry();
 *   registry.register('moon',  createMoon(timeEngine));
 *   registry.register('mars',  createMars(timeEngine));
 *   registry.register('venus', createVenus(timeEngine));
 *
 *   // In the animation loop:
 *   registry.updateAll(simTimeMs);
 *
 * This decouples main.js from knowing the list of bodies.
 */

/**
 * Template for a celestial body factory.
 *
 * Each body module must export these three functions:
 *
 *   createXxx(timeEngine) → THREE.Group
 *     Builds the Three.js scene graph nodes, subscribes to timeEngine,
 *     and stores a dispose() function in group.userData.dispose.
 *
 *   updateXxx(group, simTimeMs) → void
 *     Re-applies the orbital state for the given time. Used for manual
 *     time jumps or when you need to reposition outside the subscription.
 *
 *   disposeXxx(group) → void
 *     Calls group.userData.dispose() and removes the group from the scene
 *     if it was auto-added.
 *
 * Orbital state requirements:
 *   - Position must be computed in ECI (Earth-centred inertial) space and
 *     converted to scene space using the shared SCENE_SCALE factor from
 *     KeplerPropagator.js.
 *   - The body must NOT be parented under Earth or any other moving object.
 *     It must be added to the scene root and positioned via world coordinates.
 *   - All motion must be driven by simTimeMs from SimulationTimeEngine, not
 *     by frame count or wall-clock time.
 *
 * Material requirements:
 *   - Use MeshStandardMaterial (PBR) for physically correct sun illumination.
 *   - Provide a synchronous fallback colour; load texture asynchronously.
 *   - No custom emissive above 0.1 unless the body is self-luminous (e.g. Sun).
 *
 * Future bodies checklist:
 * ─────────────────────────
 *   [ ] Sun       — self-luminous, add PointLight, lens flare optional
 *   [ ] Mars      — own orbital elements (heliocentric → geocentric transform)
 *   [ ] Venus     — high albedo, phase effects important
 *   [ ] Jupiter   — large apparent size, band texture
 *   [ ] Asteroids — may share a generic small-body factory
 */

export const CelestialBodyInterface = Object.freeze({
    /**
     * @param {import('../../time/SimulationTimeEngine.js').SimulationTimeEngine} timeEngine
     * @returns {THREE.Group}
     */
    create: 'function(timeEngine): THREE.Group',

    /**
     * @param {THREE.Group} group
     * @param {number}      simTimeMs
     * @returns {void}
     */
    update: 'function(group, simTimeMs): void',

    /**
     * @param {THREE.Group} group
     * @returns {void}
     */
    dispose: 'function(group): void',
});
