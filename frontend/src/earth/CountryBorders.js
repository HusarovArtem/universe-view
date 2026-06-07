import * as THREE from 'three';
import { latLonToVector3 } from '../utils/latlon.js';
import { EARTH_RADIUS } from './Earth.js';

const BORDER_ALTITUDE = EARTH_RADIUS + 0.01;
const BORDER_COLOR    = 0xff4444;
const BORDER_OPACITY  = 1;

/**
 * Fetches countries.geojson and builds a THREE.LineSegments object
 * representing all country borders.
 *
 * Returns a promise that resolves to a THREE.LineSegments mesh,
 * or null if the file cannot be loaded.
 *
 * @returns {Promise<THREE.LineSegments|null>}
 */
export async function createCountryBorders() {
    let geojson;

    try {
        const res = await fetch('/src/data/countries.geojson');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        geojson = await res.json();
    } catch (err) {
        console.warn('[countryBorders] Could not load countries.geojson:', err.message);
        return null;
    }

    const positions = [];

    for (const feature of geojson.features) {
        const geom = feature.geometry;
        if (!geom) continue;

        const polys =
            geom.type === 'Polygon'        ? [geom.coordinates] :
                geom.type === 'MultiPolygon'   ? geom.coordinates   :
                    [];

        for (const poly of polys) {
            for (const ring of poly) {
                for (let i = 0; i < ring.length - 1; i++) {
                    const [lon0, lat0] = ring[i];
                    const [lon1, lat1] = ring[i + 1];

                    const v0 = latLonToVector3(lat0, lon0, BORDER_ALTITUDE);
                    const v1 = latLonToVector3(lat1, lon1, BORDER_ALTITUDE);

                    positions.push(v0.x, v0.y, v0.z);
                    positions.push(v1.x, v1.y, v1.z);
                }
            }
        }
    }

    if (positions.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    const mat = new THREE.LineBasicMaterial({
        color:       BORDER_COLOR,
        transparent: true,
        opacity:     BORDER_OPACITY,
        depthWrite:  false,
    });

    const lines = new THREE.LineSegments(geo, mat);
    lines.name = 'CountryBorders';

    return lines;
}