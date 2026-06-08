/**
 * CelestialBodyRegistry.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Central registry for all selectable celestial bodies in the simulation.
 *
 * Architecture
 * ────────────
 * The registry decouples main.js from knowing the list of bodies. It provides:
 *   - Body registration with metadata
 *   - Raycasting for click-based selection
 *   - Body lookup by name or mesh
 *
 * Design Principles
 * ─────────────────
 * - Single Responsibility: registry only tracks bodies; camera logic is in FocusManager
 * - Open/Closed: new bodies are added by calling register(), no modifications needed
 * - Each body is described by a CelestialBodyDescriptor
 *
 * @module CelestialBodyRegistry
 */

import * as THREE from 'three';

/**
 * @typedef {Object} CelestialBodyDescriptor
 * @property {string}          id          - Unique identifier (e.g. 'earth', 'moon')
 * @property {string}          name        - Display name
 * @property {THREE.Object3D}  group       - The Three.js group for this body
 * @property {THREE.Mesh}      pickMesh    - The mesh used for raycasting (can be group or specific child)
 * @property {number}          radius      - Scene-space radius
 * @property {Object}          info        - Static data for info panel
 * @property {string}          [type]      - 'planet', 'moon', 'asteroid', etc.
 */

export class CelestialBodyRegistry {
    /** @type {Map<string, CelestialBodyDescriptor>} */
    #bodies = new Map();

    /** @type {THREE.Raycaster} */
    #raycaster = new THREE.Raycaster();

    /**
     * Register a celestial body.
     * @param {CelestialBodyDescriptor} descriptor
     */
    register(descriptor) {
        if (!descriptor.id || !descriptor.group) {
            throw new Error(`[CelestialBodyRegistry] Invalid descriptor: ${JSON.stringify(descriptor)}`);
        }
        this.#bodies.set(descriptor.id, descriptor);
    }

    /**
     * Unregister a body by id.
     * @param {string} id
     */
    unregister(id) {
        this.#bodies.delete(id);
    }

    /**
     * Get a body descriptor by id.
     * @param {string} id
     * @returns {CelestialBodyDescriptor|undefined}
     */
    get(id) {
        return this.#bodies.get(id);
    }

    /**
     * Get all registered bodies.
     * @returns {CelestialBodyDescriptor[]}
     */
    getAll() {
        return [...this.#bodies.values()];
    }

    /**
     * Find which body (if any) is hit by a screen-space pointer event.
     * Returns the first body whose pickMesh is intersected.
     *
     * @param {THREE.Vector2}  ndc     - Normalized device coordinates (-1..1)
     * @param {THREE.Camera}   camera
     * @returns {CelestialBodyDescriptor|null}
     */
    pickBody(ndc, camera) {
        this.#raycaster.setFromCamera(ndc, camera);

        // Collect all pick meshes
        const meshes = [];
        for (const desc of this.#bodies.values()) {
            if (desc.pickMesh) {
                meshes.push(desc.pickMesh);
            }
        }

        const hits = this.#raycaster.intersectObjects(meshes, true);
        if (hits.length === 0) return null;

        const hitObject = hits[0].object;

        // Walk up from hit object to find which body it belongs to
        for (const desc of this.#bodies.values()) {
            if (this.#isDescendantOrSelf(hitObject, desc.group)) {
                return desc;
            }
        }

        return null;
    }

    /**
     * @param {THREE.Object3D} obj
     * @param {THREE.Object3D} ancestor
     * @returns {boolean}
     */
    #isDescendantOrSelf(obj, ancestor) {
        let current = obj;
        while (current) {
            if (current === ancestor) return true;
            current = current.parent;
        }
        return false;
    }
}
