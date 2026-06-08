import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { createScene }    from './core/scene.js';
import { createCamera }   from './core/camera.js';
import { createRenderer } from './core/renderer.js';

import { createEarth, setAtmosphereVisible } from './space/objects/earth/Earth.js';
import { createCountryBorders }              from './space/objects/earth/CountryBorders.js';
import { addCity }                           from './space/objects/earth/Cities.js';

import { HoverSystem } from './ui/HoverSystem.js';
import { InfoPanel }   from './ui/InfoPanel.js';

import { SimulationTimeEngine } from './space/time/SimulationTimeEngine.js';
import { SatelliteModule }      from './space/objects/satellite/SatelliteModule.js';
import { SatelliteRenderer }    from './space/visualization/SatelliteRenderer.js';
import { OrbitRenderer }        from './space/visualization/OrbitRenderer.js';

// ─── Moon ─────────────────────────────────────────────────────────────────────
// The Moon module is self-contained: createMoon() subscribes to the time engine
// and drives its own position + tidal-lock rotation every tick.
// disposeMoon() must be called if the scene is ever torn down.
import { createMoon, disposeMoon } from './space/objects/moon/Moon.js';

import { TimeControlPanel }      from './ui/controls/TimeControlPanel.js';
import { SatelliteControlPanel } from './ui/controls/SatelliteControlPanel.js';
import { SatelliteTooltip }      from './ui/panels/SatelliteTooltip.js';

import capitals from './data/capitals.json';

// ─── Core ────────────────────────────────────────────────────────────────────

const scene    = createScene();
const camera   = createCamera();
const renderer = createRenderer();

// ─── Lighting ────────────────────────────────────────────────────────────────
// sunLight is the single directional light that illuminates BOTH Earth and Moon.
// Its position defines the "Sun direction" in scene space. Moving it or changing
// its intensity will simultaneously affect Earth atmosphere shading and Moon
// phase geometry — physically correct because both bodies share one star.
//
// Current position (50, 30, 80) places the sun somewhat to the right, above,
// and behind the camera's default view. Phases visible from the default camera
// will depend on this direction relative to the Moon's orbital position.

const sunLight = new THREE.DirectionalLight(0xfff5e0, 1.6);
sunLight.position.set(50, 30, 80);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x112244, 0.9));

// ─── Earth ───────────────────────────────────────────────────────────────────

const earth = createEarth();
scene.add(earth);

createCountryBorders().then((borders) => {
    if (borders) {
        earth.add(borders);
        document.getElementById('bordersToggle').addEventListener('change', (e) => {
            borders.visible = e.target.checked;
        });
    } else {
        const toggle = document.getElementById('bordersToggle');
        toggle.disabled = true;
        toggle.closest('.toggle-row').style.opacity = '0.3';
    }
});

const citiesGroup = new THREE.Group();
citiesGroup.name  = 'CitiesGroup';
earth.add(citiesGroup);
const cityMeshes = capitals.map((city) => addCity(citiesGroup, city));

// ─── Simulation Time ─────────────────────────────────────────────────────────

const timeEngine = new SimulationTimeEngine(Date.now());
timeEngine.play(1);

// ─── Moon ─────────────────────────────────────────────────────────────────────
// Moon is added to the scene ROOT — not parented under Earth.
//
// Why this matters:
//   Earth rotates every frame (earth.rotation.y += 0.0012). If the Moon were
//   a child of Earth, it would spin with it at an enormous apparent velocity,
//   which is physically wrong. Parenting also makes the Moon's position
//   camera-relative in unexpected ways.
//
//   Instead, the Moon's position is computed in ECI (Earth-centred inertial)
//   space by LunarOrbit.computeLunarState() — the same coordinate frame that
//   satellite positions use — and converted to scene-space world coordinates.
//   Earth sits at scene origin (0,0,0) so ECI ≡ scene-centred for our purposes.
//
// The createMoon() call internally subscribes to timeEngine. No external update
// call is needed in the animation loop.

const moon = createMoon(timeEngine);
scene.add(moon);

// ─── Orbit Controls ──────────────────────────────────────────────────────────
// maxDistance increased from 120 → 500 so the user can zoom out enough to
// see the Moon in its orbit. At default zoom the Moon is ~60 scene units away;
// the old maxDistance of 120 allowed it but left little margin. 500 is still
// well within the scene's far plane (2000) and the star sphere (~400).

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping  = true;
controls.dampingFactor  = 0.06;
controls.enableZoom     = true;
controls.minDistance    = 6.5;
controls.maxDistance    = 500;   // extended from 120 to allow Moon viewing
controls.enablePan      = false;
controls.rotateSpeed    = 0.5;
controls.zoomSpeed      = 0.8;

// ─── Satellite Systems ───────────────────────────────────────────────────────

const satelliteModule   = new SatelliteModule(timeEngine);
const satelliteRenderer = new SatelliteRenderer(scene, renderer.domElement);
const orbitRenderer     = new OrbitRenderer(scene);

let orbitsEnabled = false;

satelliteModule.onUpdate((satellites) => {
    satelliteRenderer.update(satellites);
});

// ─── UI Systems ──────────────────────────────────────────────────────────────

const hoverSystem = new HoverSystem(camera, renderer.domElement);
hoverSystem.setTargets(cityMeshes);

const infoPanel  = new InfoPanel();
const satTooltip = new SatelliteTooltip();

new TimeControlPanel(timeEngine);

const satControl = new SatelliteControlPanel({
    onGroupChange: async (group) => {
        satControl.setStatus('Loading…');
        try {
            const n = await satelliteModule.load(group);
            satControl.setCount(n);
            satControl.setStatus(`Loaded ${n} satellites`);
            if (orbitsEnabled) {
                orbitRenderer.dispose();
                for (const sat of satelliteModule.satellites.values()) {
                    orbitRenderer.showOrbit(sat, timeEngine.simTimeMs);
                }
            }
        } catch (err) {
            satControl.setStatus(`Error: ${err.message}`, true);
            console.error('[Satellites] Load failed:', err);
        }
    },
    onVisibilityChange: (v) => satelliteRenderer.setVisible(v),
    onOrbitToggle: (enabled) => {
        orbitsEnabled = enabled;
        if (enabled) {
            for (const sat of satelliteModule.satellites.values()) {
                orbitRenderer.showOrbit(sat, timeEngine.simTimeMs);
            }
        } else {
            orbitRenderer.dispose();
        }
    },
});

// ─── Earth-layer Toggle State ─────────────────────────────────────────────────

let earthSpinning = true;
let showCities    = true;

document.getElementById('spinToggle').addEventListener('change', (e) => {
    earthSpinning = e.target.checked;
});
document.getElementById('citiesToggle').addEventListener('change', (e) => {
    showCities          = e.target.checked;
    citiesGroup.visible = showCities;
    if (!showCities) infoPanel.hide();
});
document.getElementById('atmosphereToggle').addEventListener('change', (e) => {
    setAtmosphereVisible(earth, e.target.checked);
});

// ─── Animation Loop ──────────────────────────────────────────────────────────
// NOTE: Moon position + rotation are driven entirely through timeEngine.subscribe()
// inside Moon.js. No per-frame Moon update call is needed here. This keeps the
// animation loop clean and ensures the Moon updates even when paused (it gets
// a tick(0) notification so it can correctly hold its position).

function animate() {
    requestAnimationFrame(animate);

    timeEngine.tick(performance.now());

    if (earthSpinning) earth.rotation.y += 0.0012;

    // Capital city hover
    const hoveredCity = hoverSystem.update(earth, showCities);
    if (hoveredCity) infoPanel.show(hoveredCity.userData);
    else             infoPanel.hide();

    // Satellite hover — only raycast when satellites are loaded
    if (satelliteModule.count > 0) {
        const { hoveredId } = satelliteRenderer.raycast(camera);
        if (hoveredId) {
            const sat = satelliteModule.getById(hoveredId);
            if (sat) satTooltip.show(sat);
            else     satTooltip.hide();
        } else {
            satTooltip.hide();
        }
    }

    controls.update();
    renderer.render(scene, camera);
}

animate();

// ─── Resize ──────────────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
    camera.updateAspect(window.innerWidth, window.innerHeight);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// ─── Scene cleanup (if ever needed) ─────────────────────────────────────────
// Exposed on window for debugging / hot-module-replacement scenarios.
window.__disposeMoon = () => disposeMoon(moon);
