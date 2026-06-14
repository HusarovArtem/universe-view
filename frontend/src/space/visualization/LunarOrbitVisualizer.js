/**
 * LunarOrbitVisualizer.js
 * Reusable orbital path renderer for Keplerian bodies.
 * Fixed: imports SCENE_SCALE and all required lunar constants.
 */

import * as THREE from 'three';
import {
    SCENE_SCALE,
    MOON_SMA_KM,
    MOON_ECCENTRICITY,
    MOON_INCLINATION_RAD,
    MOON_RAAN_RAD_J2000,
    MOON_ARG_PERIGEE_RAD_J2000,
} from '../objects/moon/LunarConstants.js';

const ORBIT_SEGMENTS = 256;

/**
 * @typedef {Object} OrbitalParams
 * @property {number} smaKm
 * @property {number} eccentricity
 * @property {number} inclinationRad
 * @property {number} raanRad
 * @property {number} argPerigeeRad
 * @property {number} [color]
 * @property {string} [name]
 */

export class OrbitVisualizer {
    #parent;
    #line     = null;
    #nodeLine = null;
    #visible  = true;

    constructor(parent) {
        this.#parent = parent;
    }

    showOrbit(params) {
        this.dispose();

        const points = this.#buildOrbitPoints(params);
        const geo    = new THREE.BufferGeometry().setFromPoints(points);
        const mat    = new THREE.LineBasicMaterial({
            color:       params.color ?? 0x3366aa,
            transparent: true,
            opacity:     0.45,
            depthWrite:  false,
            blending:    THREE.AdditiveBlending,
        });

        this.#line         = new THREE.Line(geo, mat);
        this.#line.name    = params.name ?? 'OrbitPath';
        this.#line.visible = this.#visible;
        this.#parent.add(this.#line);

        this.#buildNodeLine(params);
    }

    setVisible(visible) {
        this.#visible = visible;
        if (this.#line)     this.#line.visible     = visible;
        if (this.#nodeLine) this.#nodeLine.visible = visible;
    }

    get visible() { return this.#visible; }

    dispose() {
        if (this.#line) {
            this.#line.geometry.dispose();
            this.#line.material.dispose();
            this.#parent.remove(this.#line);
            this.#line = null;
        }
        if (this.#nodeLine) {
            this.#nodeLine.geometry.dispose();
            this.#nodeLine.material.dispose();
            this.#parent.remove(this.#nodeLine);
            this.#nodeLine = null;
        }
    }

    #buildOrbitPoints(params) {
        const { smaKm, eccentricity, inclinationRad, raanRad, argPerigeeRad } = params;

        const cosO = Math.cos(raanRad);
        const sinO = Math.sin(raanRad);
        const cosW = Math.cos(argPerigeeRad);
        const sinW = Math.sin(argPerigeeRad);
        const cosI = Math.cos(inclinationRad);
        const sinI = Math.sin(inclinationRad);

        // Perifocal → ECI rotation matrix columns
        const m00 =  cosO * cosW - sinO * sinW * cosI;
        const m10 =  sinO * cosW + cosO * sinW * cosI;
        const m20 =  sinW * sinI;

        const m01 = -cosO * sinW - sinO * cosW * cosI;
        const m11 = -sinO * sinW + cosO * cosW * cosI;
        const m21 =  cosW * sinI;

        const pts = [];

        for (let i = 0; i <= ORBIT_SEGMENTS; i++) {
            const nu = (i / ORBIT_SEGMENTS) * Math.PI * 2;
            const r  = (smaKm * (1 - eccentricity * eccentricity)) /
                       (1 + eccentricity * Math.cos(nu));

            const px = r * Math.cos(nu);
            const py = r * Math.sin(nu);

            const eciX = px * m00 + py * m01;
            const eciY = px * m10 + py * m11;
            const eciZ = px * m20 + py * m21;

            // Match eciToScene convention: scene(x,y,z) = (eciX, eciZ, -eciY) * SCENE_SCALE
            pts.push(new THREE.Vector3(
                 eciX * SCENE_SCALE,
                 eciZ * SCENE_SCALE,
                -eciY * SCENE_SCALE,
            ));
        }

        return pts;
    }

    #buildNodeLine(params) {
        const len = params.smaKm * SCENE_SCALE * 1.1;
        const nx  =  Math.cos(params.raanRad) * len;
        const ny  =  Math.sin(params.raanRad) * len;
        const nodeDir = new THREE.Vector3(nx, 0, -ny);

        const geo = new THREE.BufferGeometry().setFromPoints([
            nodeDir.clone().negate(),
            nodeDir,
        ]);
        const mat = new THREE.LineBasicMaterial({
            color:       0x224466,
            transparent: true,
            opacity:     0.2,
            depthWrite:  false,
        });

        this.#nodeLine         = new THREE.Line(geo, mat);
        this.#nodeLine.name    = 'OrbitNodeLine';
        this.#nodeLine.visible = this.#visible;
        this.#parent.add(this.#nodeLine);
    }
}

/** Pre-built orbital parameters for the Moon. */
export const MOON_ORBITAL_PARAMS = {
    smaKm:          MOON_SMA_KM,
    eccentricity:   MOON_ECCENTRICITY,
    inclinationRad: MOON_INCLINATION_RAD,
    raanRad:        MOON_RAAN_RAD_J2000,
    argPerigeeRad:  MOON_ARG_PERIGEE_RAD_J2000,
    color:          0x3355aa,
    name:           'MoonOrbitPath',
};
