import * as THREE from 'three';
import { SatelliteCategory } from '../core/Satellite.js';

const CATEGORY_COLORS = {
    [SatelliteCategory.ISS]:      0x00ffe0,
    [SatelliteCategory.STARLINK]: 0x4488ff,
    [SatelliteCategory.ACTIVE]:   0xffaa00,
    [SatelliteCategory.GPS]:      0x88ff44,
    [SatelliteCategory.WEATHER]:  0xff88cc,
    [SatelliteCategory.DEBRIS]:   0x666688,
    [SatelliteCategory.OTHER]:    0xaaaaaa,
};

const MARKER_SIZE  = 0.06;
const HOVER_SCALE  = 3.0;
const NORMAL_SCALE = 1.0;

/**
 * Renders satellites using THREE.InstancedMesh for performance.
 * Supports up to MAX_INSTANCES satellites with per-instance color.
 * LOD: at high zoom levels switches to billboard sprites.
 */
export class SatelliteRenderer {
    static MAX_INSTANCES = 10000;

    /** @type {THREE.InstancedMesh} */
    #mesh;
    /** @type {THREE.Scene} */
    #scene;
    /** @type {Map<string, number>} satellite id → instance index */
    #idToIndex = new Map();
    /** @type {Map<number, string>} instance index → satellite id */
    #indexToId = new Map();
    /** @type {number} */
    #count = 0;
    /** @type {THREE.Matrix4} */
    #mat4 = new THREE.Matrix4();
    /** @type {THREE.Color} */
    #color = new THREE.Color();
    /** @type {number|null} */
    #hoveredIndex = null;
    /** @type {number|null} */
    #selectedIndex = null;
    /** @type {THREE.Raycaster} */
    #raycaster;
    /** @type {THREE.Vector2} */
    #mouse;

    constructor(scene, domElement) {
        this.#scene     = scene;
        this.#raycaster = new THREE.Raycaster();
        this.#raycaster.params.Points.threshold = 0.1;
        this.#mouse     = new THREE.Vector2(-9999, -9999);

        this.#buildMesh();
        this.#bindPointer(domElement);
    }

    #buildMesh() {
        const geo = new THREE.SphereGeometry(MARKER_SIZE, 6, 6);
        const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
        this.#mesh      = new THREE.InstancedMesh(geo, mat, SatelliteRenderer.MAX_INSTANCES);
        this.#mesh.name = 'SatelliteInstances';
        this.#mesh.count = 0;
        this.#mesh.frustumCulled = false;
        this.#scene.add(this.#mesh);
    }

    #bindPointer(el) {
        el.addEventListener('mousemove', (e) => {
            const rect    = el.getBoundingClientRect();
            this.#mouse.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
            this.#mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
        });
    }

    /**
     * Bulk update all satellite positions from the module map.
     * @param {Map<string, import('../core/Satellite.js').Satellite>} satellites
     */
    update(satellites) {
        let idx = 0;

        for (const sat of satellites.values()) {
            if (idx >= SatelliteRenderer.MAX_INSTANCES) break;

            const { x, y, z } = sat.position;
            const scale = (idx === this.#hoveredIndex || idx === this.#selectedIndex)
                ? HOVER_SCALE : NORMAL_SCALE;

            this.#mat4.makeScale(scale, scale, scale);
            this.#mat4.setPosition(x, y, z);
            this.#mesh.setMatrixAt(idx, this.#mat4);

            const hex = CATEGORY_COLORS[sat.category] ?? CATEGORY_COLORS[SatelliteCategory.OTHER];
            this.#mesh.setColorAt(idx, this.#color.setHex(hex));

            if (!this.#idToIndex.has(sat.id)) {
                this.#idToIndex.set(sat.id, idx);
                this.#indexToId.set(idx, sat.id);
            }

            idx++;
        }

        this.#count       = idx;
        this.#mesh.count  = idx;
        this.#mesh.instanceMatrix.needsUpdate = true;
        if (this.#mesh.instanceColor) this.#mesh.instanceColor.needsUpdate = true;
    }

    /**
     * Run hover/selection raycasting. Call once per frame.
     * @param {THREE.Camera} camera
     * @returns {{ hoveredId: string|null, selectedId: string|null }}
     */
    raycast(camera) {
        this.#raycaster.setFromCamera(this.#mouse, camera);
        const hits = this.#raycaster.intersectObject(this.#mesh);

        const prevHovered = this.#hoveredIndex;
        this.#hoveredIndex = hits.length > 0 ? hits[0].instanceId : null;

        return {
            hoveredId:  this.#hoveredIndex !== null ? this.#indexToId.get(this.#hoveredIndex) ?? null : null,
            selectedId: this.#selectedIndex !== null ? this.#indexToId.get(this.#selectedIndex) ?? null : null,
        };
    }

    selectById(id) {
        this.#selectedIndex = this.#idToIndex.get(id) ?? null;
    }

    setVisible(visible) {
        this.#mesh.visible = visible;
    }

    dispose() {
        this.#mesh.geometry.dispose();
        this.#mesh.material.dispose();
        this.#scene.remove(this.#mesh);
    }
}
