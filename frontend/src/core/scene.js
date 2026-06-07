import * as THREE from 'three';

/**
 * Creates and returns the main Three.js scene.
 * Stars are added here as a background element.
 */
export function createScene() {
    const scene = new THREE.Scene();

    // Starfield — simple random point cloud
    const starCount = 8000;
    const positions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
        const i3 = i * 3;
        // distribute on a large sphere
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 400 + Math.random() * 200;

        positions[i3]     = r * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = r * Math.cos(phi);
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const starMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.35,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.85,
    });

    scene.add(new THREE.Points(starGeo, starMat));

    return scene;
}