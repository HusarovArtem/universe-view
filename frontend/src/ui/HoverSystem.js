import * as THREE from 'three';

/**
 * Generic hover detection over a list of meshes via raycasting.
 *
 * Body-agnostic: instead of hardcoding highlightCity/resetCity, the caller
 * supplies onEnter / onLeave callbacks (or they default to no-op).
 *
 * Usage:
 *   const hover = new HoverSystem(camera, domElement, {
 *       onEnter: mesh => highlightCity(mesh),
 *       onLeave: mesh => resetCity(mesh),
 *   });
 *   hover.setTargets(cityMeshArray);
 *   // in animation loop:
 *   const hit = hover.update(rootGroup, enabled);
 */
export class HoverSystem {
    #camera;
    #domElement;
    #raycaster;
    #mouse;
    #hovered  = null;
    #targets  = [];
    #listeners = [];
    #onEnter;
    #onLeave;

    /**
     * @param {THREE.Camera}  camera
     * @param {HTMLElement}   domElement
     * @param {{ onEnter?: (mesh: THREE.Mesh) => void, onLeave?: (mesh: THREE.Mesh) => void }} [callbacks]
     */
    constructor(camera, domElement, callbacks = {}) {
        this.#camera     = camera;
        this.#domElement = domElement;
        this.#raycaster  = new THREE.Raycaster();
        this.#raycaster.params.Points.threshold = 0.1;
        this.#mouse      = new THREE.Vector2(-9999, -9999);
        this.#onEnter    = callbacks.onEnter ?? (() => {});
        this.#onLeave    = callbacks.onLeave ?? (() => {});

        const onMove = (e) => {
            const rect = domElement.getBoundingClientRect();
            this.#mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
            this.#mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
        };

        domElement.addEventListener('mousemove', onMove);
        this.#listeners.push(() => domElement.removeEventListener('mousemove', onMove));
    }

    /** Replace all hover targets. */
    setTargets(targets) { this.#targets = targets; }

    /**
     * Run hover detection. Call once per animation frame.
     * @param {THREE.Object3D} root  - object whose world matrices need updating
     * @param {boolean}        enabled
     * @returns {THREE.Mesh|null}
     */
    update(root, enabled = true) {
        if (!enabled) {
            if (this.#hovered) {
                this.#onLeave(this.#hovered);
                this.#hovered = null;
            }
            return null;
        }

        root.updateMatrixWorld(true);

        this.#raycaster.setFromCamera(this.#mouse, this.#camera);
        const hits = this.#raycaster.intersectObjects(this.#targets, false);
        const hit  = hits.length > 0 ? hits[0].object : null;

        if (hit !== this.#hovered) {
            if (this.#hovered) this.#onLeave(this.#hovered);
            this.#hovered = hit;
            if (this.#hovered) this.#onEnter(this.#hovered);
        }

        return this.#hovered;
    }

    dispose() {
        this.#listeners.forEach(fn => fn());
        this.#listeners = [];
    }
}
