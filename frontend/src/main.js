import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { createScene }   from './core/scene.js';
import { createCamera }  from './core/camera.js';
import { createRenderer } from './core/renderer.js';

import { createEarth, setAtmosphereVisible } from './earth/Earth.js';
import { createCountryBorders }              from './earth/CountryBorders.js';
import { addCity }                           from './earth/cities.js';

import { HoverSystem } from './ui/HoverSystem.js';
import { InfoPanel }   from './ui/InfoPanel.js';

import capitals from './data/capitals.json';

// ─────────────────────────────────────────────────────────────────────────────
// RENDERER / SCENE / CAMERA
// ─────────────────────────────────────────────────────────────────────────────

const scene    = createScene();
const camera   = createCamera();
const renderer = createRenderer();

// ─────────────────────────────────────────────────────────────────────────────
// LIGHTING
// Lights go in the scene, not inside Earth, so they illuminate everything.
// ─────────────────────────────────────────────────────────────────────────────

const sunLight = new THREE.DirectionalLight(0xfff5e0, 1.6);
sunLight.position.set(50, 30, 80);
scene.add(sunLight);

// Faint ambient so the dark side isn't pitch-black
const ambientLight = new THREE.AmbientLight(0x112244, 0.9);
scene.add(ambientLight);

// ─────────────────────────────────────────────────────────────────────────────
// EARTH
// ─────────────────────────────────────────────────────────────────────────────

const earth = createEarth();
scene.add(earth);

// Country borders (async — loaded from GeoJSON)
createCountryBorders().then((borders) => {
    if (borders) {
        earth.add(borders);
        // Wire up toggle AFTER borders exist
        document.getElementById('bordersToggle').addEventListener('change', (e) => {
            borders.visible = e.target.checked;
        });
    } else {
        // No borders loaded — disable the toggle
        const toggle = document.getElementById('bordersToggle');
        toggle.disabled = true;
        toggle.closest('.toggle-row').style.opacity = '0.3';
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// CITY MARKERS
// All markers live inside a group that is a child of the earth group,
// so they rotate with the globe automatically.
// ─────────────────────────────────────────────────────────────────────────────

const citiesGroup = new THREE.Group();
citiesGroup.name  = 'CitiesGroup';
earth.add(citiesGroup);

/** @type {THREE.Mesh[]} */
const cityMeshes = capitals.map((city) => addCity(citiesGroup, city));

// ─────────────────────────────────────────────────────────────────────────────
// ORBIT CONTROLS
// ─────────────────────────────────────────────────────────────────────────────

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping    = true;
controls.dampingFactor    = 0.06;
controls.enableZoom       = true;
controls.minDistance      = 6.5;   // can't clip inside earth
controls.maxDistance      = 60;
controls.enablePan        = false;
controls.rotateSpeed      = 0.5;
controls.zoomSpeed        = 0.8;

// ─────────────────────────────────────────────────────────────────────────────
// UI SYSTEMS
// ─────────────────────────────────────────────────────────────────────────────

const hoverSystem = new HoverSystem(camera, renderer.domElement);
hoverSystem.setTargets(cityMeshes);

const infoPanel = new InfoPanel();

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────

let earthSpinning = true;
let showCities    = true;

// ─────────────────────────────────────────────────────────────────────────────
// UI CONTROL WIRING
// ─────────────────────────────────────────────────────────────────────────────

document.getElementById('spinToggle').addEventListener('change', (e) => {
    earthSpinning = e.target.checked;
});

document.getElementById('citiesToggle').addEventListener('change', (e) => {
    showCities             = e.target.checked;
    citiesGroup.visible    = showCities;
    if (!showCities) infoPanel.hide();
});

document.getElementById('atmosphereToggle').addEventListener('change', (e) => {
    setAtmosphereVisible(earth, e.target.checked);
});

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION LOOP
// ─────────────────────────────────────────────────────────────────────────────

function animate() {
    requestAnimationFrame(animate);

    if (earthSpinning) {
        earth.rotation.y += 0.0012;
    }

    // Hover detection
    const hoveredMesh = hoverSystem.update(earth, showCities);

    if (hoveredMesh) {
        infoPanel.show(hoveredMesh.userData);
    } else {
        infoPanel.hide();
    }

    controls.update();
    renderer.render(scene, camera);
}

animate();

// ─────────────────────────────────────────────────────────────────────────────
// RESIZE
// ─────────────────────────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
    camera.updateAspect(window.innerWidth, window.innerHeight);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});