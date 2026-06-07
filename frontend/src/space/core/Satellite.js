import { SpaceObject, SpaceObjectType } from './SpaceObject.js';

export const SatelliteCategory = Object.freeze({
    ACTIVE:   'ACTIVE',
    STARLINK: 'STARLINK',
    ISS:      'ISS',
    DEBRIS:   'DEBRIS',
    WEATHER:  'WEATHER',
    GPS:      'GPS',
    OTHER:    'OTHER',
});

export class Satellite extends SpaceObject {
    /** @type {string} NORAD catalog ID */
    noradId;
    /** @type {string} COSPAR designation */
    cosparId;
    /** @type {string} SatelliteCategory */
    category;
    /** @type {number|null} altitude in km */
    altitudeKm;
    /** @type {string|null} */
    country;
    /** @type {string|null} launch date ISO */
    launchDate;
    /** @type {OrbitalElements|null} */
    orbitalElements;

    constructor(data) {
        super({ ...data, type: SpaceObjectType.SATELLITE });
        this.noradId         = data.noradId;
        this.cosparId        = data.cosparId ?? null;
        this.category        = data.category ?? SatelliteCategory.OTHER;
        this.altitudeKm      = data.altitudeKm ?? null;
        this.country         = data.country ?? null;
        this.launchDate      = data.launchDate ?? null;
        this.orbitalElements = data.orbitalElements ?? null;
    }
}

export class OrbitalElements {
    /** @type {number} semi-major axis in km */
    semiMajorAxisKm;
    /** @type {number} eccentricity 0-1 */
    eccentricity;
    /** @type {number} inclination degrees */
    inclinationDeg;
    /** @type {number} right ascension of ascending node degrees */
    raanDeg;
    /** @type {number} argument of perigee degrees */
    argPerigeeDeg;
    /** @type {number} mean anomaly degrees */
    meanAnomalyDeg;
    /** @type {number} mean motion revolutions per day */
    meanMotion;
    /** @type {number} epoch Unix ms */
    epochMs;

    constructor(data) {
        Object.assign(this, data);
    }

    getPeriodMs() {
        return (86400 / this.meanMotion) * 1000;
    }

    getAltitudeKm() {
        const EARTH_RADIUS_KM = 6371;
        return this.semiMajorAxisKm - EARTH_RADIUS_KM;
    }
}
