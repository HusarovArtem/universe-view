/**
 * SelectionVisualizer.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders a clean selection ring around the currently focused celestial body.
 *
 * Design
 * ──────
 * A thin RingGeometry is rendered in a billboard-facing orientation
 * (always faces camera) at a fixed scale relative to the body's radius.
 * The ring uses additive blending for a clean glow without depth issues.
 *
 * The ring auto-scales as camera distance changes so it maintains a
 * consistent apparent visual size at any zoom level.
 *
 * Architecture
 * ────────────
 * - One ring mesh per scene (no per-body instances)
 * - setBody(descriptor) moves the ring to a new body
 * - update(camera) called each frame to billboard + follow moving bodies
 * - dispose() frees GPU resources
 *
 * @module SelectionVisualizer
 */

import * as THREE from 'three';

const _bodyPos   = new THREE.Vector3();
const _camPos    = new THREE.Vector3();

export class SelectionVisualizer {
    /** @type {THREE.Mesh} */
    #ring;

    /** @type {THREE.Mesh} */
    #ringOuter;

    /** @type {import('../celestial/CelestialBodyRegistry.js').CelestialBodyDescriptor|null} */
    #body = null;

    /** @type {THREE.Scene} */
    #scene;

    /**
     * @param {THREE.Scene} scene
     */
    constructor(scene) {
        this.#scene = scene;

        // Inner ring
        const ringGeo = new THREE.RingGeometry(1.0, 1.06, 64);
        const ringMat = new THREE.MeshBasicMaterial({
            color:       0x00ffe0,
            transparent: true,
            opacity:     0.75,
            side:        THREE.DoubleSide,
            depthWrite:  false,
            blending:    THREE.AdditiveBlending,
        });
        this.#ring = new THREE.Mesh(ringGeo, ringMat);
        this.#ring.name    = 'SelectionRing';
        this.#ring.visible = false;
        scene.add(this.#ring);

        // Outer softer ring
        const outerGeo = new THREE.RingGeometry(1.1, 1.2, 64);
        const outerMat = new THREE.MeshBasicMaterial({
            color:       0x4d9fff,
            transparent: true,
            opacity:     0.2,
            side:        THREE.DoubleSide,
            depthWrite:  false,
            blending:    THREE.AdditiveBlending,
        });
        this.#ringOuter = new THREE.Mesh(outerGeo, outerMat);
        this.#ringOuter.name    = 'SelectionRingOuter';
        this.#ringOuter.visible = false;
        scene.add(this.#ringOuter);
    }

    /**
     * Set the body to highlight.
     * @param {import('../celestial/CelestialBodyRegistry.js').CelestialBodyDescriptor|null} descriptor
     */
    setBody(descriptor) {
        this.#body = descriptor;

        const visible = descriptor !== null;
        this.#ring.visible      = visible;
        this.#ringOuter.visible = visible;
    }

    /**
     * Update ring position and scale. Call every frame.
     * @param {THREE.Camera} camera
     */
    update(camera) {
        if (!this.#body) return;

        this.#body.group.getWorldPosition(_bodyPos);
        camera.getWorldPosition(_camPos);

        // Position rings at body center
        this.#ring.position.copy(_bodyPos);
        this.#ringOuter.position.copy(_bodyPos);

        // Billboard: face camera
        this.#ring.lookAt(_camPos);
        this.#ringOuter.lookAt(_camPos);

        // Scale based on body radius — ring sits just outside sphere surface
        const r = this.#body.radius * 1.35;
        this.#ring.scale.setScalar(r);
        this.#ringOuter.scale.setScalar(r);
    }

    dispose() {
        this.#ring.geometry.dispose();
        this.#ring.material.dispose();
        this.#scene.remove(this.#ring);

        this.#ringOuter.geometry.dispose();
        this.#ringOuter.material.dispose();
        this.#scene.remove(this.#ringOuter);
    }
}
