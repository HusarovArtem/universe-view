/**
 * FocusManager.js
 * Manages smooth camera focus transitions between celestial bodies.
 *
 * Key fix: OrbitControls is DISABLED during the lerp transition so the two
 * systems do not fight each other. Controls are re-enabled the moment the
 * camera converges on the target.
 */

import * as THREE from 'three';

const ZOOM_RADII   = 4.5;
const LERP_SPEED   = 0.07;
const LERP_EPSILON = 0.001;

const _worldPos      = new THREE.Vector3();
const _desiredTarget = new THREE.Vector3();
const _camOffset     = new THREE.Vector3();

export class FocusManager {
    #currentBody   = null;
    #targetBody    = null;
    #controls;
    #camera;
    #listeners     = new Set();
    #transitioning = false;
    #targetDistance = 0;

    constructor(camera, controls) {
        this.#camera   = camera;
        this.#controls = controls;
    }

    focusBody(descriptor) {
        if (!descriptor) return;

        const wasBody = this.#currentBody;
        this.#targetBody    = descriptor;
        this.#currentBody   = descriptor;
        this.#transitioning = true;

        this.#targetDistance = Math.max(
            this.#controls.minDistance,
            Math.min(descriptor.radius * ZOOM_RADII, this.#controls.maxDistance),
        );

        // Disable controls so they don't fight the lerp
        this.#controls.enabled = false;

        this.#emit({ from: wasBody, to: descriptor });
    }

    update() {
        if (!this.#targetBody || !this.#transitioning) return;

        this.#targetBody.group.getWorldPosition(_worldPos);
        _desiredTarget.copy(_worldPos);

        // Lerp controls target toward body world position
        this.#controls.target.lerp(_desiredTarget, LERP_SPEED);

        // Lerp camera distance while preserving viewing direction
        _camOffset.subVectors(this.#camera.position, this.#controls.target);
        const currentDist = _camOffset.length();

        if (currentDist > 0) {
            const newDist = THREE.MathUtils.lerp(currentDist, this.#targetDistance, LERP_SPEED);
            _camOffset.normalize().multiplyScalar(newDist);
            this.#camera.position.copy(this.#controls.target).add(_camOffset);
        }

        const targetDelta = _desiredTarget.distanceTo(this.#controls.target);
        const distDelta   = Math.abs(currentDist - this.#targetDistance);

        if (targetDelta < LERP_EPSILON && distDelta < LERP_EPSILON) {
            // Snap exact and re-enable controls
            this.#controls.target.copy(_desiredTarget);
            this.#transitioning = false;
            this.#controls.enabled = true;
        }
    }

    /** Cancel any in-progress transition and immediately re-enable controls. */
    cancelFocus() {
        this.#transitioning = false;
        this.#controls.enabled = true;
    }

    onFocusChange(callback) {
        this.#listeners.add(callback);
        return () => this.#listeners.delete(callback);
    }

    get currentBody()    { return this.#currentBody; }
    get isTransitioning(){ return this.#transitioning; }

    #emit(event) {
        for (const fn of this.#listeners) fn(event);
    }
}
