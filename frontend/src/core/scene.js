import * as THREE from 'three';

/**
 * Creates and returns the main Three.js scene.
 *
 * Changes from original:
 *   - Star sphere radius increased from 400–600 to 800–1000.
 *     The Moon orbits at ~60.3 scene units from Earth. With the original
 *     star radius of 400, the Moon is well inside the stars, which is correct.
 *     However, when the user zooms out to maxDistance=500 to view the Moon,
 *     the star sphere should still enclose the camera. 800 gives comfortable
 *     margin while staying within the camera's far plane (2000).
 *   - Star count increased from 8000 to 12000 for better density at wider FOV.
 *
 * Stars are distributed uniformly on the sphere using the standard
 * spherical-coordinate rejection sampling approach.
 */
export function createScene() {
    const scene = new THREE.Scene();

    // ── Starfield ─────────────────────────────────────────────────────────────
    const starCount = 12000;
    const positions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
        const i3    = i * 3;
        // Uniform distribution on sphere surface (Marsaglia / spherical coords)
        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.acos(2 * Math.random() - 1);
        // Vary the radius slightly to give a subtle depth feeling
        const r     = 800 + Math.random() * 200;

        positions[i3]     = r * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = r * Math.cos(phi);
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const starMat = new THREE.PointsMaterial({
        color:           0xffffff,
        size:            0.35,
        sizeAttenuation: true,
        transparent:     true,
        opacity:         0.85,
    });

    scene.add(new THREE.Points(starGeo, starMat));

    return scene;
}
