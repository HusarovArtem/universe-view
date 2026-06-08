import * as THREE from 'three';

export const SpaceObjectType = Object.freeze({
    SATELLITE:   'SATELLITE',
    PLANET:      'PLANET',
    MOON:        'MOON',
    ASTEROID:    'ASTEROID',
    COMET:       'COMET',
    STAR:        'STAR',
    GALAXY:      'GALAXY',
    DEEP_SPACE:  'DEEP_SPACE',
});

export class SpaceObject {
    /** @type {string} */
    id;
    /** @type {string} */
    name;
    /** @type {string} SpaceObjectType */
    type;
    /** @type {{ x: number, y: number, z: number }} */
    position;
    /** @type {{ x: number, y: number, z: number }} */
    velocity;
    /** @type {Record<string, any>} */
    metadata;

    constructor({ id, name, type, position = { x:0,y:0,z:0 }, velocity = { x:0,y:0,z:0 }, metadata = {} }) {
        this.id       = id;
        this.name     = name;
        this.type     = type;
        this.position = position;
        this.velocity = velocity;
        this.metadata = metadata;
    }

    toVector3() {
        return new THREE.Vector3(this.position.x, this.position.y, this.position.z);
    }

    getVelocityVector3() {
        return new THREE.Vector3(this.velocity.x, this.velocity.y, this.velocity.z);
    }

    getSpeed() {
        const v = this.velocity;
        return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    }
}
