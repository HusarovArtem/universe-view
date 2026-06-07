import * as THREE from 'three';

/**
 * Converts geographic coordinates to a 3D position on a sphere.
 *
 * @param {number} lat  - latitude  in degrees  (-90  … +90)
 * @param {number} lon  - longitude in degrees  (-180 … +180)
 * @param {number} radius - sphere radius (default 5)
 * @returns {THREE.Vector3}
 */
export function latLonToVector3(lat, lon, radius = 5) {
    const phi   = (90 - lat)  * (Math.PI / 180);   // polar angle from +Y
    const theta = (lon + 180) * (Math.PI / 180);   // azimuthal from +Z

    return new THREE.Vector3(
        -radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta),
    );
}

/**
 * Converts a 3D position back to lat/lon degrees.
 *
 * @param {THREE.Vector3} vec
 * @returns {{ lat: number, lon: number }}
 */
export function vector3ToLatLon(vec) {
    const normalized = vec.clone().normalize();
    const lat = 90 - Math.acos(normalized.y) * (180 / Math.PI);
    const lon = (Math.atan2(normalized.z, -normalized.x) * (180 / Math.PI)) - 180;
    return { lat, lon };
}