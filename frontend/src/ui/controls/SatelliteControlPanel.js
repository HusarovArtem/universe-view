/**
 * Panel for satellite layer controls: group select, visibility, orbit toggle.
 */
export class SatelliteControlPanel {
    #el;
    #onGroupChange;
    #onVisibilityChange;
    #onOrbitToggle;

    constructor({ onGroupChange, onVisibilityChange, onOrbitToggle }) {
        this.#onGroupChange      = onGroupChange;
        this.#onVisibilityChange = onVisibilityChange;
        this.#onOrbitToggle      = onOrbitToggle;
        this.#build();
    }

    #build() {
        this.#el = document.createElement('div');
        this.#el.id = 'satelliteControls';
        this.#el.className = 'satellite-controls-panel';
        this.#el.innerHTML = `
            <div class="sc-title">SATELLITES</div>
            <div class="sc-count" id="scCount">— objects</div>
            <div class="toggle-row">
                <span class="toggle-label">SHOW</span>
                <label class="toggle-wrapper">
                    <input type="checkbox" id="satVisible" checked>
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <div class="toggle-row">
                <span class="toggle-label">ORBITS</span>
                <label class="toggle-wrapper">
                    <input type="checkbox" id="satOrbits">
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <div class="sc-group-label">DATASET</div>
            <select id="satGroup" class="sc-select">
                <option value="active">Active Satellites</option>
                <option value="iss">ISS</option>
                <option value="starlink">Starlink</option>
            </select>
            <button id="satLoad" class="sc-load-btn">LOAD</button>
            <div class="sc-status" id="scStatus"></div>
        `;
        document.body.appendChild(this.#el);

        document.getElementById('satVisible').addEventListener('change', (e) => {
            this.#onVisibilityChange(e.target.checked);
        });

        document.getElementById('satOrbits').addEventListener('change', (e) => {
            this.#onOrbitToggle(e.target.checked);
        });

        document.getElementById('satLoad').addEventListener('click', () => {
            const group = document.getElementById('satGroup').value;
            this.#onGroupChange(group);
        });
    }

    setCount(n) {
        const el = document.getElementById('scCount');
        if (el) el.textContent = `${n.toLocaleString()} objects`;
    }

    setStatus(msg, isError = false) {
        const el = document.getElementById('scStatus');
        if (!el) return;
        el.textContent = msg;
        el.style.color = isError ? '#ff4455' : '#00ffe0';
    }
}
