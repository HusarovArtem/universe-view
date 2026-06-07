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

import { TimeControlPanel }      from './ui/controls/TimeControlPanel.js';
import { SatelliteControlPanel } from './ui/controls/SatelliteControlPanel.js';
import { SatelliteTooltip }      from './ui/panels/SatelliteTooltip.js';

import capitals from './data/capitals.json';

// ─── Core ────────────────────────────────────────────────────────────────────

const scene    = createScene();
const camera   = createCamera();
const renderer = createRenderer();

// ─── Lighting ────────────────────────────────────────────────────────────────

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

// ─── Satellite Systems ───────────────────────────────────────────────────────

const satelliteModule   = new SatelliteModule(timeEngine);
const satelliteRenderer = new SatelliteRenderer(scene, renderer.domElement);
const orbitRenderer     = new OrbitRenderer(scene);

let orbitsEnabled = false;

satelliteModule.onUpdate((satellites) => {
    satelliteRenderer.update(satellites);
});

// ─── Controls ────────────────────────────────────────────────────────────────

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping  = true;
controls.dampingFactor  = 0.06;
controls.enableZoom     = true;
controls.minDistance    = 6.5;
controls.maxDistance    = 120;
controls.enablePan      = false;
controls.rotateSpeed    = 0.5;
controls.zoomSpeed      = 0.8;

// ─── UI Systems ──────────────────────────────────────────────────────────────

const hoverSystem    = new HoverSystem(camera, renderer.domElement);
hoverSystem.setTargets(cityMeshes);

const infoPanel      = new InfoPanel();
const satTooltip     = new SatelliteTooltip();
const timeControl    = new TimeControlPanel(timeEngine);

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

// ─── State ───────────────────────────────────────────────────────────────────

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

function animate() {
    requestAnimationFrame(animate);

    timeEngine.tick(performance.now());

    if (earthSpinning) earth.rotation.y += 0.0012;

    const hoveredCity = hoverSystem.update(earth, showCities);
    if (hoveredCity) infoPanel.show(hoveredCity.userData);
    else infoPanel.hide();

    const { hoveredId } = satelliteRenderer.raycast(camera);
    if (hoveredId) {
        const sat = satelliteModule.getById(hoveredId);
        if (sat) satTooltip.show(sat);
    } else {
        satTooltip.hide();
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