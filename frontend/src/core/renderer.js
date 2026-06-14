import * as THREE from 'three';

/**
 * Creates and configures the WebGL renderer.
 * Appends its canvas to document.body.
 */
export function createRenderer() {
    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x00050f, 1);

    // Shadow mapping — required for eclipse-capable architecture.
    // PCFSoftShadowMap gives smooth penumbra edges without the hard-edge
    // artifacts of basic shadow maps.
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFShadowMap;

    document.body.appendChild(renderer.domElement);

    return renderer;
}