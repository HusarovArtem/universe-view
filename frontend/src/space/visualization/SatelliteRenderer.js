import * as THREE from 'three';
import { SatelliteCategory } from '../objects/satellite/Satellite.js';

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

const _pos   = new THREE.Vector3();
const _quat  = new THREE.Quaternion();
const _scale = new THREE.Vector3();

export class SatelliteRenderer {
    static MAX_INSTANCES = 10000;

    #mesh;
    #scene;
    // Rebuilt every update() call — always accurate
    #idToIndex = new Map();
    #indexToId = new Map();
    #mat4      = new THREE.Matrix4();
    #color     = new THREE.Color();
    #hoveredIndex  = null;
    #selectedIndex = null;
    #raycaster;
    #mouse;
    #visible = true;

    constructor(scene, domElement) {
        this.#scene     = scene;
        this.#raycaster = new THREE.Raycaster();
        this.#mouse     = new THREE.Vector2(-9999, -9999);
        this.#buildMesh();
        this.#bindPointer(domElement);
    }

    #buildMesh() {
        const geo = new THREE.SphereGeometry(MARKER_SIZE, 6, 6);
        const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
        this.#mesh               = new THREE.InstancedMesh(geo, mat, SatelliteRenderer.MAX_INSTANCES);
        this.#mesh.name          = 'SatelliteInstances';
        this.#mesh.count         = 0;
        this.#mesh.frustumCulled = false;
        this.#scene.add(this.#mesh);
    }

    #bindPointer(el) {
        el.addEventListener('mousemove', (e) => {
            const rect    = el.getBoundingClientRect();
            this.#mouse.x = ((e.clientX - rect.left) / rect.width)  *  2 - 1;
            this.#mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
        });
    }

    update(satellites) {
        // Rebuild index maps fresh every call — prevents stale ids after group switch
        this.#idToIndex.clear();
        this.#indexToId.clear();

        let idx = 0;

        for (const sat of satellites.values()) {
            if (idx >= SatelliteRenderer.MAX_INSTANCES) break;

            const { x, y, z } = sat.position;
            const scale = (idx === this.#hoveredIndex || idx === this.#selectedIndex)
                ? HOVER_SCALE : NORMAL_SCALE;

            // Correct matrix composition: translate * scale (no rotation needed)
            this.#mat4.makeTranslation(x, y, z);
            this.#mat4.scale(_scale.set(scale, scale, scale));
            this.#mesh.setMatrixAt(idx, this.#mat4);

            const hex = CATEGORY_COLORS[sat.category] ?? CATEGORY_COLORS[SatelliteCategory.OTHER];
            this.#mesh.setColorAt(idx, this.#color.setHex(hex));

            this.#idToIndex.set(sat.id, idx);
            this.#indexToId.set(idx, sat.id);

            idx++;
        }

        this.#mesh.count = idx;
        this.#mesh.instanceMatrix.needsUpdate = true;
        if (this.#mesh.instanceColor) this.#mesh.instanceColor.needsUpdate = true;
    }

    raycast(camera) {
        if (this.#mesh.count === 0) return { hoveredId: null, selectedId: null };

        this.#raycaster.setFromCamera(this.#mouse, camera);
        const hits = this.#raycaster.intersectObject(this.#mesh);

        this.#hoveredIndex = hits.length > 0 ? hits[0].instanceId ?? null : null;

        return {
            hoveredId:  this.#hoveredIndex  !== null ? (this.#indexToId.get(this.#hoveredIndex)  ?? null) : null,
            selectedId: this.#selectedIndex !== null ? (this.#indexToId.get(this.#selectedIndex) ?? null) : null,
        };
    }

    selectById(id) {
        this.#selectedIndex = this.#idToIndex.get(id) ?? null;
    }

    setVisible(visible) {
        this.#visible      = visible;
        this.#mesh.visible = visible;
    }

    dispose() {
        this.#mesh.geometry.dispose();
        this.#mesh.material.dispose();
        this.#scene.remove(this.#mesh);
    }
}
