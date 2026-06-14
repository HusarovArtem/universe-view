/**
 * CelestialInfoPanel.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Information panel for the currently focused celestial body.
 *
 * Architecture
 * ────────────
 * - Body-agnostic: data comes from body descriptor's `info` object
 * - Dynamic fields: each body can have a different set of displayed fields
 * - Data-driven: all values come from descriptor, not hardcoded in UI
 * - Smooth animate in/out
 *
 * @module CelestialInfoPanel
 */

export class CelestialInfoPanel {
    /** @type {HTMLElement} */
    #el;

    constructor() {
        this.#el = this.#build();
        document.body.appendChild(this.#el);
    }

    /**
     * Display info for a celestial body descriptor.
     * @param {import('../objects/celestial/CelestialBodyRegistry.js').CelestialBodyDescriptor} descriptor
     */
    show(descriptor) {
        const { info } = descriptor;
        if (!info) { this.hide(); return; }

        this.#el.querySelector('.cbip-name').textContent  = info.name ?? descriptor.name;
        this.#el.querySelector('.cbip-type').textContent  = info.type ?? '';

        const rows = this.#el.querySelector('.cbip-rows');
        rows.innerHTML = '';

        for (const [label, value] of Object.entries(info.fields ?? {})) {
            const row = document.createElement('div');
            row.className = 'cbip-row';
            row.innerHTML = `
                <span class="cbip-label">${label}</span>
                <span class="cbip-value">${value}</span>
            `;
            rows.appendChild(row);
        }

        this.#el.classList.remove('hidden');
    }

    /** Hide the panel */
    hide() {
        this.#el.classList.add('hidden');
    }

    #build() {
        const el = document.createElement('div');
        el.id = 'celestialInfoPanel';
        el.className = 'hidden';
        el.innerHTML = `
            <div class="cbip-tag">CELESTIAL BODY</div>
            <div class="cbip-name">—</div>
            <div class="cbip-type">—</div>
            <div class="cbip-rows"></div>
        `;
        return el;
    }
}

/**
 * Static data for Earth.
 * @type {Object}
 */
export const EARTH_INFO = {
    name: 'EARTH',
    type: 'Terrestrial Planet · Sol III',
    fields: {
        'RADIUS':      '6,371 km',
        'MASS':        '5.972 × 10²⁴ kg',
        'POPULATION':  '8.1 Billion',
        'SATELLITES':  '1 Natural · 8,000+ Artificial',
        'DAY LENGTH':  '23h 56m',
        'GRAVITY':     '9.807 m/s²',
    },
};

/**
 * Static data for Moon.
 * @type {Object}
 */
export const MOON_INFO = {
    name: 'MOON',
    type: 'Natural Satellite · Earth',
    fields: {
        'RADIUS':      '1,737 km',
        'MASS':        '7.342 × 10²² kg',
        'DISTANCE':    '~384,400 km avg',
        'ORBIT PERIOD':'27.32 Earth days',
        'TIDAL LOCK':  'Yes — near side always faces Earth',
        'GRAVITY':     '1.62 m/s²',
    },
};

/**
 * Static data for Sun.
 * @type {Object}
 */
export const SUN_INFO = {
    name: 'SUN',
    type: 'G-Type Main-Sequence Star · Sol',
    fields: {
        'RADIUS':       '696,000 km',
        'MASS':         '1.989 × 10³⁰ kg',
        'SURFACE TEMP': '5,778 K',
        'DISTANCE':     '~149.6 million km',
        'LUMINOSITY':   '3.828 × 10²⁶ W',
        'AGE':          '4.603 billion years',
    },
};
