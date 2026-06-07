import { TimeSpeed } from '../../space/time/SimulationTimeEngine.js';

const SPEED_OPTIONS = [
    { label: '⏮ -10×', value: TimeSpeed.REWIND_10 },
    { label: '⏪ -1×',  value: TimeSpeed.REWIND_1 },
    { label: '⏸',       value: TimeSpeed.PAUSED },
    { label: '▶ 1×',   value: TimeSpeed.REAL },
    { label: '⏩ 10×',  value: TimeSpeed.FAST_10 },
    { label: '⏩ 100×', value: TimeSpeed.FAST_100 },
    { label: '⏩ 1K×',  value: TimeSpeed.FAST_1000 },
];

/**
 * Time control bar — shows sim date/time and speed buttons.
 */
export class TimeControlPanel {
    #engine;
    #el;
    #timeEl;
    #speedEl;
    #buttons = [];

    /** @param {import('../../space/time/SimulationTimeEngine.js').SimulationTimeEngine} engine */
    constructor(engine) {
        this.#engine = engine;
        this.#build();
        engine.subscribe(() => this.#render());
    }

    #build() {
        this.#el = document.createElement('div');
        this.#el.id = 'timeControl';
        this.#el.className = 'time-control-panel';
        this.#el.innerHTML = `
            <div class="tc-date" id="tcDate">—</div>
            <div class="tc-speed-label">SIM SPEED: <span id="tcSpeed">1×</span></div>
            <div class="tc-buttons" id="tcButtons"></div>
        `;
        document.body.appendChild(this.#el);

        this.#timeEl  = document.getElementById('tcDate');
        this.#speedEl = document.getElementById('tcSpeed');

        const btns = document.getElementById('tcButtons');
        for (const opt of SPEED_OPTIONS) {
            const btn = document.createElement('button');
            btn.className   = 'tc-btn';
            btn.textContent = opt.label;
            btn.dataset.speed = String(opt.value);
            btn.addEventListener('click', () => {
                this.#engine.setSpeed(opt.value);
                if (opt.value !== TimeSpeed.PAUSED) this.#engine.play(opt.value);
                else this.#engine.pause();
                this.#highlightActive(opt.value);
            });
            btns.appendChild(btn);
            this.#buttons.push(btn);
        }

        this.#highlightActive(TimeSpeed.REAL);
    }

    #highlightActive(speed) {
        for (const btn of this.#buttons) {
            btn.classList.toggle('active', Number(btn.dataset.speed) === speed);
        }
        const mult = speed === 0 ? 'PAUSED' : (speed > 0 ? `${speed}×` : `${speed}× ⏪`);
        this.#speedEl.textContent = mult;
    }

    #render() {
        const d = this.#engine.simDate;
        this.#timeEl.textContent = d.toUTCString().replace('GMT', 'UTC');
    }
}
