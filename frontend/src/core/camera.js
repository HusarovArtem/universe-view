import * as THREE from 'three';

/**
 * Creates a perspective camera sized to the current viewport.
 * Call camera.updateAspect(w, h) on resize.
 */
export function createCamera() {
    const camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        2000
    );

    camera.position.set(0, 0, 14);

    // Convenience helper — call on window resize
    camera.updateAspect = (width, height) => {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    };

    return camera;
}