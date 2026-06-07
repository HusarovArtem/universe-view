import * as THREE from 'three';

export function createEarth() {
    const geometry = new THREE.SphereGeometry(5, 64, 64);

    const texture = new THREE.TextureLoader().load(
        'https://threejs.org/examples/textures/land_ocean_ice_cloud_2048.jpg'
    );

    const material = new THREE.MeshBasicMaterial({
        map: texture
    });

    const earth = new THREE.Mesh(geometry, material);

    return earth;
}