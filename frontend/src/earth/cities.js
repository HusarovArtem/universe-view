import * as THREE from 'three';
import { latLonToVector3 } from '../utils/latlon.js';
import { EARTH_RADIUS } from './Earth.js';

// Sit slightly above the surface to avoid z-fighting
const MARKER_ALTITUDE = EARTH_RADIUS + 0.04;

const COLOR_DEFAULT = new THREE.Color(0xff4455);
const COLOR_HOVERED = new THREE.Color(0x00ffe0);

// Shared geometry — all markers reuse the same geometry (performance)
const SHARED_GEO = new THREE.SphereGeometry(0.045, 8, 8);

/**
 * Creates a single capital city marker and adds it to `parent`.
 *
 * @param {THREE.Object3D} parent   - the group to add the marker to
 * @param {{ name: string, lat: number, lon: number }} city
 * @returns {THREE.Mesh}  the marker mesh (userData has name/lat/lon)
 */
export function addCity(parent, city) {
    const mat = new THREE.MeshBasicMaterial({ color: COLOR_DEFAULT });
    const mesh = new THREE.Mesh(SHARED_GEO, mat);

    mesh.position.copy(latLonToVector3(city.lat, city.lon, MARKER_ALTITUDE));

    mesh.userData = {
        type: 'capital',
        name: city.name,
        lat:  city.lat,
        lon:  city.lon,
    };

    mesh.name = `City_${city.name}`;
    parent.add(mesh);

    return mesh;
}

/**
 * Highlights a city marker (hover state).
 * @param {THREE.Mesh} mesh
 */
export function highlightCity(mesh) {
    mesh.material.color.copy(COLOR_HOVERED);
    mesh.scale.setScalar(1.7);
}

/**
 * Resets a city marker to default state.
 * @param {THREE.Mesh} mesh
 */
export function resetCity(mesh) {
    mesh.material.color.copy(COLOR_DEFAULT);
    mesh.scale.setScalar(1);
}