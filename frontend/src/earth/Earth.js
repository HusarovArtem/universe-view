import * as THREE from 'three';

export const EARTH_RADIUS = 5;

/**
 * Creates the main Earth group containing:
 *   - earth surface mesh (textured)
 *   - atmosphere glow layer
 *
 * All child objects (borders, cities) should be added to the returned group.
 *
 * @returns {THREE.Group}
 */
export function createEarth() {
    const group = new THREE.Group();
    group.name = 'Earth';

    // ── Surface ──────────────────────────────────────────────────────────────
    const loader = new THREE.TextureLoader();

    const surfaceGeo = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
    const surfaceMat = new THREE.MeshPhongMaterial({
        map:          loader.load('https://threejs.org/examples/textures/land_ocean_ice_cloud_2048.jpg'),
        specularMap:  loader.load('https://threejs.org/examples/textures/water.jpg'),
        specular:     new THREE.Color(0x111122),
        shininess:    12,
        bumpScale:    0.02,
    });

    const surfaceMesh = new THREE.Mesh(surfaceGeo, surfaceMat);
    surfaceMesh.name = 'EarthSurface';
    group.add(surfaceMesh);

    // ── Atmosphere ────────────────────────────────────────────────────────────
    const atmGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.025, 64, 64);
    const atmMat = new THREE.MeshPhongMaterial({
        color:       0x4488ff,
        transparent: true,
        opacity:     0.07,
        side:        THREE.FrontSide,
        depthWrite:  false,
        blending:    THREE.AdditiveBlending,
    });

    const atmosphere = new THREE.Mesh(atmGeo, atmMat);
    atmosphere.name = 'Atmosphere';
    group.add(atmosphere);

    // ── Lights (belong here so they travel with nothing — added to scene in main) ──
    // Lights are added to the SCENE in main.js, not here. This keeps Earth pure.

    return group;
}

/**
 * Sets atmosphere visibility.
 * @param {THREE.Group} earthGroup
 * @param {boolean} visible
 */
export function setAtmosphereVisible(earthGroup, visible) {
    const atm = earthGroup.getObjectByName('Atmosphere');
    if (atm) atm.visible = visible;
}