import * as THREE from 'three';
import { latLonToVector3 } from './latlon.js';

export function addCity(parent, city, radius = 5) {
    const geometry = new THREE.SphereGeometry(0.05, 8, 8);

    const material = new THREE.MeshBasicMaterial({
        color: 0xff4444
    });

    const point = new THREE.Mesh(geometry, material);

    const pos = latLonToVector3(city.lat, city.lon, radius);
    point.position.copy(pos);

    // 🔥 important: prevent weird scaling inheritance
    point.matrixAutoUpdate = true;

    parent.add(point);

    return point;
}