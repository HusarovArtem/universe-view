import * as THREE from 'three';
import { highlightCity, resetCity } from '../earth/cities.js';

/**
 * Manages mouse hover detection over a list of meshes using raycasting.
 *
 * Usage:
 *   const hover = new HoverSystem(camera, renderer.domElement);
 *   hover.addTargets(cityMeshArray);
 *   // in animation loop:
 *   const hit = hover.update(earthGroup);
 */
export class HoverSystem {
    /** @type {THREE.Camera} */
    #camera;
    /** @type {HTMLElement} */
    #domElement;
    /** @type {THREE.Raycaster} */
    #raycaster;
    /** @type {THREE.Vector2} */
    #mouse;
    /** @type {THREE.Mesh|null} */
    #hovered = null;
    /** @type {THREE.Mesh[]} */
    #targets = [];
    /** @type {Function[]} */
    #listeners = [];

    /**
     * @param {THREE.Camera} camera
     * @param {HTMLElement} domElement
     */
    constructor(camera, domElement) {
        this.#camera     = camera;
        this.#domElement = domElement;
        this.#raycaster  = new THREE.Raycaster();
        this.#raycaster.params.Points.threshold = 0.1;
        this.#mouse      = new THREE.Vector2(-9999, -9999); // offscreen until first move

        const onMove = (e) => {
            const rect = domElement.getBoundingClientRect();
            this.#mouse.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
            this.#mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
        };

        domElement.addEventListener('mousemove', onMove);
        this.#listeners.push(() => domElement.removeEventListener('mousemove', onMove));
    }

    /**
     * Replace all hover targets.
     * @param {THREE.Mesh[]} targets
     */
    setTargets(targets) {
        this.#targets = targets;
    }

    /**
     * Run hover detection. Call once per animation frame.
     * Forces matrix updates on the given root object before raycasting.
     *
     * @param {THREE.Object3D} root - the object whose world matrices need updating
     * @param {boolean} enabled     - if false, clears any active hover and returns null
     * @returns {THREE.Mesh|null}   - currently hovered mesh, or null
     */
    update(root, enabled = true) {
        if (!enabled) {
            if (this.#hovered) {
                resetCity(this.#hovered);
                this.#hovered = null;
            }
            return null;
        }

        // IMPORTANT: force world matrix update before casting
        root.updateMatrixWorld(true);

        this.#raycaster.setFromCamera(this.#mouse, this.#camera);
        const hits = this.#raycaster.intersectObjects(this.#targets, false);

        const hit = hits.length > 0 ? hits[0].object : null;

        if (hit !== this.#hovered) {
            if (this.#hovered) resetCity(this.#hovered);
            this.#hovered = hit;
            if (this.#hovered) highlightCity(this.#hovered);
        }

        return this.#hovered;
    }

    /** Clean up event listeners */
    dispose() {
        this.#listeners.forEach(fn => fn());
        this.#listeners = [];
    }
}
