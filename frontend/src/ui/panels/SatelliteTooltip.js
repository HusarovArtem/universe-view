/**
 * Floating tooltip that follows the cursor and shows satellite data.
 * Fully decoupled from Three.js.
 */
export class SatelliteTooltip {
    #el;
    #nameEl;
    #noradEl;
    #altEl;
    #catEl;

    constructor() {
        this.#el = document.createElement('div');
        this.#el.id = 'satelliteTooltip';
        this.#el.className = 'sat-tooltip hidden';
        this.#el.innerHTML = `
            <div class="sat-tooltip-tag">SATELLITE</div>
            <div class="sat-tooltip-name" id="satTipName"></div>
            <div class="sat-tooltip-row"><span>NORAD</span><span id="satTipNorad"></span></div>
            <div class="sat-tooltip-row"><span>ALT</span><span id="satTipAlt"></span></div>
            <div class="sat-tooltip-row"><span>TYPE</span><span id="satTipCat"></span></div>
        `;
        document.body.appendChild(this.#el);
        this.#nameEl  = document.getElementById('satTipName');
        this.#noradEl = document.getElementById('satTipNorad');
        this.#altEl   = document.getElementById('satTipAlt');
        this.#catEl   = document.getElementById('satTipCat');

        document.addEventListener('mousemove', (e) => {
            this.#el.style.left = (e.clientX + 16) + 'px';
            this.#el.style.top  = (e.clientY - 10) + 'px';
        });
    }

    /** @param {import('../space/core/Satellite.js').Satellite} sat */
    show(sat) {
        this.#nameEl.textContent  = sat.name;
        this.#noradEl.textContent = sat.noradId ?? '—';
        this.#altEl.textContent   = sat.altitudeKm != null ? `${sat.altitudeKm.toFixed(0)} km` : '—';
        this.#catEl.textContent   = sat.category;
        this.#el.classList.remove('hidden');
    }

    hide() {
        this.#el.classList.add('hidden');
    }
}
