/**
 * Controls the right-side info panel DOM element.
 * Decoupled from Three.js — only deals with the DOM.
 */
export class InfoPanel {
    #el;
    #nameEl;
    #latEl;
    #lonEl;
    #coordsEl;

    constructor() {
        this.#el      = document.getElementById('infoPanel');
        this.#nameEl  = document.getElementById('infoName');
        this.#latEl   = document.getElementById('infoLat');
        this.#lonEl   = document.getElementById('infoLon');
        this.#coordsEl = document.getElementById('hud-coords');
    }

    /**
     * Show the panel with city data.
     * @param {{ name: string, lat: number, lon: number }} city
     */
    show(city) {
        this.#nameEl.textContent = city.name.toUpperCase();
        this.#latEl.textContent  = city.lat.toFixed(4) + '°';
        this.#lonEl.textContent  = city.lon.toFixed(4) + '°';

        this.#el.classList.remove('hidden');
        document.body.classList.add('hovering-city');
    }

    /** Hide the panel */
    hide() {
        this.#el.classList.add('hidden');
        document.body.classList.remove('hovering-city');
        this.#coordsEl.textContent = 'LAT — / LON —';
    }

    /**
     * Update the HUD coordinate display only (no panel).
     * @param {number} lat
     * @param {number} lon
     */
    updateCoords(lat, lon) {
        this.#coordsEl.textContent =
            `LAT ${lat >= 0 ? '+' : ''}${lat.toFixed(2)}° / LON ${lon >= 0 ? '+' : ''}${lon.toFixed(2)}°`;
    }
}
