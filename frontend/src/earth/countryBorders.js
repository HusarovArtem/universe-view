import * as THREE from "three";
import borders from "../data/countries.geojson";

import { latLonToVector3 } from "./latlon";

export function createCountryBorders(radius = 5.01) {
    const group = new THREE.Group();

    borders.features.forEach(feature => {

        const geometry = feature.geometry;

        if (geometry.type !== "Polygon") {
            return;
        }

        geometry.coordinates.forEach(ring => {

            const points = [];

            ring.forEach(([lon, lat]) => {

                const p = latLonToVector3(
                    lat,
                    lon,
                    radius
                );

                points.push(p);

            });

            const lineGeometry =
                new THREE.BufferGeometry().setFromPoints(points);

            const line =
                new THREE.Line(
                    lineGeometry,
                    new THREE.LineBasicMaterial({
                        color: 0x55aaff
                    })
                );

            group.add(line);

        });

    });

    return group;
}