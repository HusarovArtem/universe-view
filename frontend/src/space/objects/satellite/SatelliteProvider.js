import { Satellite, OrbitalElements, SatelliteCategory } from '../../core/Satellite.js';

// ─── Provider abstraction ──────────────────────────────────────────────────

export class SatelliteProvider {
    /** @returns {Promise<Satellite[]>} */
    async fetchActive()   { throw new Error('Not implemented'); }
    /** @returns {Promise<Satellite[]>} */
    async fetchISS()      { throw new Error('Not implemented'); }
    /** @returns {Promise<Satellite[]>} */
    async fetchStarlink() { throw new Error('Not implemented'); }
    /** @returns {Promise<Satellite[]>} */
    async fetchByGroup(group) { throw new Error('Not implemented'); }
    /** @returns {string} */
    get providerName() { return 'Unknown'; }
}

// ─── TLE parser ───────────────────────────────────────────────────────────

const MU_KM3_S2 = 398600.4418;

function parseTLE(name, line1, line2) {
    const noradId       = line1.slice(2, 7).trim();
    const cosparId      = line1.slice(9, 17).trim();
    const epochYear2d   = parseInt(line1.slice(18, 20));
    const epochDay      = parseFloat(line1.slice(20, 32));
    const fullYear      = epochYear2d < 57 ? 2000 + epochYear2d : 1900 + epochYear2d;
    const epochMs       = Date.UTC(fullYear, 0, 1) + (epochDay - 1) * 86400000;

    const inclinationDeg  = parseFloat(line2.slice(8, 16));
    const raanDeg         = parseFloat(line2.slice(17, 25));
    const eccentricity    = parseFloat('0.' + line2.slice(26, 33).trim());
    const argPerigeeDeg   = parseFloat(line2.slice(34, 42));
    const meanAnomalyDeg  = parseFloat(line2.slice(43, 51));
    const meanMotion      = parseFloat(line2.slice(52, 63));

    const n               = meanMotion * 2 * Math.PI / 86400;
    const semiMajorAxisKm = Math.cbrt(MU_KM3_S2 / (n * n));

    return new OrbitalElements({
        semiMajorAxisKm,
        eccentricity,
        inclinationDeg,
        raanDeg,
        argPerigeeDeg,
        meanAnomalyDeg,
        meanMotion,
        epochMs,
    });
}

function tlesToSatellites(text, category) {
    const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
    const sats  = [];

    for (let i = 0; i < lines.length - 2; i += 3) {
        try {
            const name     = lines[i].replace(/^0 /, '').trim();
            const line1    = lines[i + 1];
            const line2    = lines[i + 2];
            const elements = parseTLE(name, line1, line2);
            const noradId  = line1.slice(2, 7).trim();

            sats.push(new Satellite({
                id:              `tle-${noradId}`,
                name,
                noradId,
                category,
                altitudeKm:      elements.getAltitudeKm(),
                orbitalElements: elements,
            }));
        } catch {
            // malformed TLE — skip
        }
    }

    return sats;
}

// ─── CelesTrak groups ─────────────────────────────────────────────────────

const CELESTRAK_BASE = 'https://celestrak.org/SOCRATES/query.php';
const CELESTRAK_TLE  = 'https://celestrak.org/SOCRATES/query.php';

const GROUPS = {
    active:   'https://celestrak.org/SOCRATES/query.php?GROUP=active&FORMAT=TLE',
    iss:      'https://celestrak.org/SOCRATES/query.php?CATNR=25544&FORMAT=TLE',
    starlink: 'https://celestrak.org/SOCRATES/query.php?GROUP=starlink&FORMAT=TLE',
};

const CELESTRAK_GROUPS = {
    active:   { url: '/api/satellites/tle/active',   category: SatelliteCategory.ACTIVE },
    iss:      { url: '/api/satellites/tle/iss',      category: SatelliteCategory.ISS },
    starlink: { url: '/api/satellites/tle/starlink', category: SatelliteCategory.STARLINK },
};

// ─── CelesTrakProvider ────────────────────────────────────────────────────

export class CelesTrakProvider extends SatelliteProvider {
    get providerName() { return 'CelesTrak'; }

    async #fetchGroup(groupKey) {
        const group    = CELESTRAK_GROUPS[groupKey];
        const response = await fetch(group.url);
        if (!response.ok) throw new Error(`CelesTrak fetch failed: ${response.status}`);
        const text = await response.text();
        return tlesToSatellites(text, group.category);
    }

    async fetchActive()   { return this.#fetchGroup('active'); }
    async fetchISS()      { return this.#fetchGroup('iss'); }
    async fetchStarlink() { return this.#fetchGroup('starlink'); }

    async fetchByGroup(group) {
        if (!CELESTRAK_GROUPS[group]) throw new Error(`Unknown group: ${group}`);
        return this.#fetchGroup(group);
    }
}

// ─── Provider registry ────────────────────────────────────────────────────

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
