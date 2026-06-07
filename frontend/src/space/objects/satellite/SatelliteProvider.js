import { Satellite, OrbitalElements, SatelliteCategory } from '../../core/Satellite.js';

export class SatelliteProvider {
    async fetchActive()       { throw new Error('Not implemented'); }
    async fetchISS()          { throw new Error('Not implemented'); }
    async fetchStarlink()     { throw new Error('Not implemented'); }
    async fetchByGroup(group) { throw new Error('Not implemented'); }
    get providerName()        { return 'Unknown'; }
}

// Backend returns SatelliteDto[] — map it into domain Satellite objects
function dtoToSatellite(dto) {
    const el = dto.orbitalElements;
    const elements = el ? new OrbitalElements({
        semiMajorAxisKm: el.semiMajorAxisKm,
        eccentricity:    el.eccentricity,
        inclinationDeg:  el.inclinationDeg,
        raanDeg:         el.raanDeg,
        argPerigeeDeg:   el.argPerigeeDeg,
        meanAnomalyDeg:  el.meanAnomalyDeg,
        meanMotion:      el.meanMotionRevPerDay,
        epochMs:         new Date(el.epoch).getTime(),
    }) : null;

    const categoryMap = {
        ACTIVE:           SatelliteCategory.ACTIVE,
        ISS:              SatelliteCategory.ISS,
        STARLINK:         SatelliteCategory.STARLINK,
        WEATHER:          SatelliteCategory.WEATHER,
        GPS:              SatelliteCategory.GPS,
        DEBRIS:           SatelliteCategory.DEBRIS,
        OTHER_SATELLITE:  SatelliteCategory.OTHER,
    };

    return new Satellite({
        id:              dto.id,
        name:            dto.name,
        noradId:         dto.noradId,
        category:        categoryMap[dto.category] ?? SatelliteCategory.OTHER,
        altitudeKm:      elements?.getAltitudeKm() ?? null,
        orbitalElements: elements,
    });
}

async function fetchFromBackend(group) {
    const url      = `/api/satellites?group=${group}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Backend fetch failed: ${response.status} for group=${group}`);
    const dtos = await response.json();
    return dtos.map(dtoToSatellite);
}

export class CelesTrakProvider extends SatelliteProvider {
    get providerName() { return 'CelesTrak'; }

    async fetchActive()       { return fetchFromBackend('active'); }
    async fetchISS()          { return fetchFromBackend('iss'); }
    async fetchStarlink()     { return fetchFromBackend('starlink'); }
    async fetchByGroup(group) { return fetchFromBackend(group); }
}

export class SatelliteProviderRegistry {
    #providers = new Map();

    register(name, provider) {
        if (!(provider instanceof SatelliteProvider)) {
            throw new TypeError('Must extend SatelliteProvider');
        }
        this.#providers.set(name, provider);
    }

    get(name) {
        const p = this.#providers.get(name);
        if (!p) throw new Error(`Provider '${name}' not registered`);
        return p;
    }

    getAll() { return Array.from(this.#providers.values()); }
}
