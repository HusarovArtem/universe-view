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
    #ring;
    #ringOuter;
    #body = null;
    #scene;

    constructor(scene) {
        this.#scene = scene;

        const ringGeo = new THREE.RingGeometry(0.975, 1.0, 128);
        const ringMat = new THREE.MeshBasicMaterial({
            color:       0x00ffee,
            transparent: true,
            opacity:     0.88,
            side:        THREE.DoubleSide,
            depthWrite:  false,
            blending:    THREE.AdditiveBlending,
        });
        this.#ring = new THREE.Mesh(ringGeo, ringMat);
        this.#ring.name    = 'SelectionRing';
        this.#ring.visible = false;
        scene.add(this.#ring);

        const outerGeo = new THREE.RingGeometry(1.04, 1.07, 128);
        const outerMat = new THREE.MeshBasicMaterial({
            color:       0x55aaff,
            transparent: true,
            opacity:     0.14,
            side:        THREE.DoubleSide,
            depthWrite:  false,
            blending:    THREE.AdditiveBlending,
        });
        this.#ringOuter = new THREE.Mesh(outerGeo, outerMat);
        this.#ringOuter.name    = 'SelectionRingOuter';
        this.#ringOuter.visible = false;
        scene.add(this.#ringOuter);
    }

    setBody(descriptor) {
        this.#body = descriptor;
        const visible = descriptor !== null;
        this.#ring.visible      = visible;
        this.#ringOuter.visible = visible;
    }

    update(camera) {
        if (!this.#body) return;

        this.#body.group.getWorldPosition(_bodyPos);
        camera.getWorldPosition(_camPos);

        this.#ring.position.copy(_bodyPos);
        this.#ringOuter.position.copy(_bodyPos);

        this.#ring.lookAt(_camPos);
        this.#ringOuter.lookAt(_camPos);

        const r = this.#body.radius * 1.10;
        this.#ring.scale.setScalar(r);
        this.#ringOuter.scale.setScalar(r);

        const pulse = 0.70 + 0.18 * Math.sin(performance.now() * 0.0025);
        this.#ring.material.opacity = pulse;
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
