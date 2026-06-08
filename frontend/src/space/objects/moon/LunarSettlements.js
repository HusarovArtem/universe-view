/**
 * LunarSettlements.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders planned/proposed lunar settlement markers on the Moon's surface.
 *
 * Architecture
 * ────────────
 * Mirrors Earth's Cities.js pattern but adapted for:
 *   - The Moon's coordinate system (lat/lon on unit sphere, then scaled to Moon radius)
 *   - Moon radius from LunarConstants (not EARTH_RADIUS)
 *   - Separate color scheme with status-based color coding
 *   - "Planned/Proposed" caveat in all UI representations
 *
 * The settlements are added to the Moon group, so they automatically follow
 * the Moon's world position as it orbits. This is the same pattern as Earth
 * cities being added to the Earth group.
 *
 * @module LunarSettlements
 */

import * as THREE from 'three';
import { latLonToVector3 } from '../../../utils/latlon.js';
import { MOON_RADIUS_SCENE } from './LunarConstants.js';

// Sit slightly above the surface
const MARKER_ALTITUDE = MOON_RADIUS_SCENE + 0.005;

// Status-based colors
const STATUS_COLORS = {
    'planned':        0x00ffe0,
    'proposed':       0x4d9fff,
    'in-development': 0xffcc00,
    'heritage':       0xff9944,
    'default':        0x8899bb,
};

const COLOR_HOVERED = new THREE.Color(0xffffff);

// Shared geometry — all markers reuse it
const SHARED_GEO = new THREE.SphereGeometry(0.018, 8, 8);

/**
 * Adds a single lunar settlement marker to the given parent (Moon group).
 *
 * @param {THREE.Object3D} parent
 * @param {{ name: string, lat: number, lon: number, status: string, description: string }} settlement
 * @returns {THREE.Mesh}
 */
export function addLunarSettlement(parent, settlement) {
    const color = STATUS_COLORS[settlement.status] ?? STATUS_COLORS.default;
    const mat   = new THREE.MeshBasicMaterial({ color });
    const mesh  = new THREE.Mesh(SHARED_GEO, mat);

    mesh.position.copy(latLonToVector3(settlement.lat, settlement.lon, MARKER_ALTITUDE));

    mesh.userData = {
        type:        'lunar_settlement',
        name:        settlement.name,
        lat:         settlement.lat,
        lon:         settlement.lon,
        status:      settlement.status,
        description: settlement.description,
    };

    mesh.name = `LunarSettlement_${settlement.name}`;
    parent.add(mesh);

    return mesh;
}

/**
 * Highlights a settlement marker on hover.
 * @param {THREE.Mesh} mesh
 */
export function highlightSettlement(mesh) {
    mesh.material.color.copy(COLOR_HOVERED);
    mesh.scale.setScalar(1.8);
}

/**
 * Resets a settlement marker to its default state.
 * @param {THREE.Mesh} mesh
 */
export function resetSettlement(mesh) {
    const status = mesh.userData.status ?? 'default';
    const hex = STATUS_COLORS[status] ?? STATUS_COLORS.default;
    mesh.material.color.setHex(hex);
    mesh.scale.setScalar(1);
}
