/**
 * main.js — Universe View Stage 3: Multi-Body Space Viewer
 *
 * Fixed:
 *  1. HoverSystem uses generic callbacks (no Earth-specific imports in HoverSystem)
 *  2. CelestialLabelSystem registers radius, not pixel offset
 *  3. Click vs drag: only fire body-pick on pointer movement < 4px
 *  4. moonHoverSystem.update() called in the animation loop
 *  5. FocusManager disables OrbitControls during transition
 *  6. CelestialInfoPanel positioned below #infoPanel to avoid overlap
 *  7. LunarOrbitVisualizer imports fixed (SCENE_SCALE etc.)
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { createScene }    from './core/scene.js';
import { createCamera }   from './core/camera.js';
import { createRenderer } from './core/renderer.js';

import { createEarth, setAtmosphereVisible, EARTH_RADIUS } from './space/objects/earth/Earth.js';
import { createCountryBorders }                             from './space/objects/earth/CountryBorders.js';
import { addCity, highlightCity, resetCity }                from './space/objects/earth/Cities.js';

import { HoverSystem } from './ui/HoverSystem.js';
import { InfoPanel }   from './ui/InfoPanel.js';

import { SimulationTimeEngine } from './space/time/SimulationTimeEngine.js';
import { SatelliteModule }      from './space/objects/satellite/SatelliteModule.js';
import { SatelliteRenderer }    from './space/visualization/SatelliteRenderer.js';
import { OrbitRenderer }        from './space/visualization/OrbitRenderer.js';

import { createMoon, disposeMoon }                          from './space/objects/moon/Moon.js';
import { MOON_RADIUS_SCENE }                                from './space/objects/moon/LunarConstants.js';
import { addLunarSettlement, highlightSettlement, resetSettlement }
    from './space/objects/moon/LunarSettlements.js';

import { TimeControlPanel }      from './ui/controls/TimeControlPanel.js';
import { SatelliteControlPanel } from './ui/controls/SatelliteControlPanel.js';
import { SatelliteTooltip }      from './ui/panels/SatelliteTooltip.js';

import { CelestialBodyRegistry } from './space/objects/celestial/CelestialBodyRegistry.js';
import { FocusManager }          from './space/objects/celestial/FocusManager.js';
import { SelectionVisualizer }   from './space/objects/celestial/SelectionVisualizer.js';
import { OrbitVisualizer, MOON_ORBITAL_PARAMS } from './space/visualization/LunarOrbitVisualizer.js';
import { CelestialLabelSystem }  from './space/visualization/CelestialLabelSystem.js';
import { CelestialInfoPanel, EARTH_INFO, MOON_INFO } from './ui/CelestialInfoPanel.js';

import capitals         from './data/capitals.json';
import lunarSettlements from './data/lunar_settlements.json';

// ─── Core ─────────────────────────────────────────────────────────────────────

const scene    = createScene();
const camera   = createCamera();
const renderer = createRenderer();

// ─── Lighting ─────────────────────────────────────────────────────────────────

const sunLight = new THREE.DirectionalLight(0xfff5e0, 1.6);
sunLight.position.set(50, 30, 80);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x112244, 0.9));

// ─── Earth ────────────────────────────────────────────────────────────────────

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

const earthCitiesGroup = new THREE.Group();
earthCitiesGroup.name  = 'EarthCitiesGroup';
earth.add(earthCitiesGroup);
const cityMeshes = capitals.map((city) => addCity(earthCitiesGroup, city));

// ─── Simulation Time ──────────────────────────────────────────────────────────

const timeEngine = new SimulationTimeEngine(Date.now());
timeEngine.play(1);

// ─── Moon ─────────────────────────────────────────────────────────────────────

const moon = createMoon(timeEngine);
scene.add(moon);

const moonSettlementsGroup = new THREE.Group();
moonSettlementsGroup.name  = 'MoonSettlementsGroup';
moon.add(moonSettlementsGroup);

let settlementMeshes     = [];
let showLunarSettlements = true;

function buildLunarSettlements() {
    while (moonSettlementsGroup.children.length) {
        const c = moonSettlementsGroup.children[0];
        c.material?.dispose();
        moonSettlementsGroup.remove(c);
    }
    settlementMeshes = lunarSettlements.map((s) =>
        addLunarSettlement(moonSettlementsGroup, s)
    );
    // Keep moonHoverSystem targets in sync
    moonHoverSystem.setTargets(settlementMeshes);
}

// ─── Orbit Controls ───────────────────────────────────────────────────────────

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enableZoom    = true;
controls.minDistance   = 4.5;
controls.maxDistance   = 600;
controls.enablePan     = false;
controls.rotateSpeed   = 0.5;
controls.zoomSpeed     = 0.8;

// ─── Celestial Body Registry ──────────────────────────────────────────────────

const bodyRegistry = new CelestialBodyRegistry();

const earthPickMesh = earth.getObjectByName('EarthSurface') ?? earth;
bodyRegistry.register({
    id:       'earth',
    name:     'Earth',
    group:    earth,
    pickMesh: earthPickMesh,
    radius:   EARTH_RADIUS,
    info:     EARTH_INFO,
    type:     'planet',
});

const moonPickMesh = moon.getObjectByName('MoonSurface') ?? moon;
bodyRegistry.register({
    id:       'moon',
    name:     'Moon',
    group:    moon,
    pickMesh: moonPickMesh,
    radius:   MOON_RADIUS_SCENE,
    info:     MOON_INFO,
    type:     'moon',
});

// ─── Focus Manager ────────────────────────────────────────────────────────────

const focusManager = new FocusManager(camera, controls);
focusManager.focusBody(bodyRegistry.get('earth'));

// ─── Selection Visualizer ─────────────────────────────────────────────────────

const selectionViz = new SelectionVisualizer(scene);
selectionViz.setBody(bodyRegistry.get('earth'));

// ─── Orbit Visualizer ─────────────────────────────────────────────────────────

const moonOrbitViz  = new OrbitVisualizer(scene);
let moonOrbitVisible = false;

// ─── Celestial Labels ─────────────────────────────────────────────────────────

const labelSystem = new CelestialLabelSystem(camera, renderer);

// Pass radius so the system can compute correct screen-space label position
labelSystem.register({
    id:       'earth-label',
    group:    earth,
    title:    'EARTH',
    subtitle: 'Population: 8.1B',
    radius:   EARTH_RADIUS,
});

labelSystem.register({
    id:       'moon-label',
    group:    moon,
    title:    'MOON',
    subtitle: 'Natural Satellite',
    radius:   MOON_RADIUS_SCENE,
});

// ─── Celestial Info Panel ─────────────────────────────────────────────────────

const celestialInfoPanel = new CelestialInfoPanel();
celestialInfoPanel.show(bodyRegistry.get('earth'));

focusManager.onFocusChange(({ to }) => {
    if (to) {
        celestialInfoPanel.show(to);
        selectionViz.setBody(to);

        // Update focus button active state
        document.querySelectorAll('.focus-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(to.id === 'earth' ? 'focusEarth' : 'focusMoon');
        if (activeBtn) activeBtn.classList.add('active');
    }
});

// ─── Click Picker — drag vs click discrimination ──────────────────────────────

const _clickNDC   = new THREE.Vector2();
let _pointerDownX = 0;
let _pointerDownY = 0;

renderer.domElement.addEventListener('pointerdown', (e) => {
    _pointerDownX = e.clientX;
    _pointerDownY = e.clientY;
});

renderer.domElement.addEventListener('pointerup', (e) => {
    // Only treat as a click if the pointer didn't move more than 4px (drag threshold)
    const dx = e.clientX - _pointerDownX;
    const dy = e.clientY - _pointerDownY;
    if (Math.sqrt(dx * dx + dy * dy) > 4) return;

    const rect = renderer.domElement.getBoundingClientRect();
    _clickNDC.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    _clickNDC.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;

    const body = bodyRegistry.pickBody(_clickNDC, camera);
    if (body) {
        focusManager.focusBody(body);
        infoPanel.hide();
    }
});

// ─── Satellite Systems ────────────────────────────────────────────────────────

const satelliteModule   = new SatelliteModule(timeEngine);
const satelliteRenderer = new SatelliteRenderer(scene, renderer.domElement);
const orbitRenderer     = new OrbitRenderer(scene);

let orbitsEnabled = false;

satelliteModule.onUpdate((satellites) => {
    satelliteRenderer.update(satellites);
});

// ─── UI Systems ───────────────────────────────────────────────────────────────

// Earth city hover — generic callbacks
const hoverSystem = new HoverSystem(camera, renderer.domElement, {
    onEnter: (mesh) => highlightCity(mesh),
    onLeave: (mesh) => resetCity(mesh),
});
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

// ─── Lunar Settlement Hover ───────────────────────────────────────────────────
// Declared before buildLunarSettlements() so setTargets can be called inside it

const settlementTooltip = document.getElementById('settlementTooltip');

const moonHoverSystem = new HoverSystem(camera, renderer.domElement, {
    onEnter: (mesh) => {
        highlightSettlement(mesh);
        _showSettlementTooltip(mesh);
    },
    onLeave: (mesh) => {
        resetSettlement(mesh);
        _hideSettlementTooltip();
    },
});

// Build settlements now (also calls moonHoverSystem.setTargets)
buildLunarSettlements();

// ─── Layer Toggle State ───────────────────────────────────────────────────────

let earthSpinning   = true;
let showCities      = true;
let showEarthLabels = true;
let showMoonLabels  = true;

document.getElementById('spinToggle').addEventListener('change', (e) => {
    earthSpinning = e.target.checked;
});

document.getElementById('citiesToggle').addEventListener('change', (e) => {
    showCities              = e.target.checked;
    earthCitiesGroup.visible = showCities;
    if (!showCities) infoPanel.hide();
});

document.getElementById('atmosphereToggle').addEventListener('change', (e) => {
    setAtmosphereVisible(earth, e.target.checked);
});

document.getElementById('moonOrbitToggle').addEventListener('change', (e) => {
    moonOrbitVisible = e.target.checked;
    if (moonOrbitVisible) {
        moonOrbitViz.showOrbit(MOON_ORBITAL_PARAMS);
    } else {
        moonOrbitViz.dispose();
    }
});

document.getElementById('earthLabelsToggle').addEventListener('change', (e) => {
    showEarthLabels = e.target.checked;
    labelSystem.setVisible('earth-label', showEarthLabels);
});

document.getElementById('moonLabelsToggle').addEventListener('change', (e) => {
    showMoonLabels = e.target.checked;
    labelSystem.setVisible('moon-label', showMoonLabels);
});

document.getElementById('lunarSettlementsToggle').addEventListener('change', (e) => {
    showLunarSettlements         = e.target.checked;
    moonSettlementsGroup.visible = showLunarSettlements;
});

document.getElementById('focusEarth').addEventListener('click', () => {
    focusManager.focusBody(bodyRegistry.get('earth'));
});
document.getElementById('focusMoon').addEventListener('click', () => {
    focusManager.focusBody(bodyRegistry.get('moon'));
});

// Mark initial focus button
document.getElementById('focusEarth').classList.add('active');

// ─── Tooltip mouse tracking ───────────────────────────────────────────────────

let _lastMouseX = 0;
let _lastMouseY = 0;

renderer.domElement.addEventListener('mousemove', (e) => {
    _lastMouseX = e.clientX;
    _lastMouseY = e.clientY;
    // Update tooltip position while hovered
    if (settlementTooltip.style.display !== 'none') {
        settlementTooltip.style.left = `${_lastMouseX + 16}px`;
        settlementTooltip.style.top  = `${_lastMouseY - 8}px`;
    }
});

// ─── Animation Loop ───────────────────────────────────────────────────────────

function animate() {
    requestAnimationFrame(animate);

    timeEngine.tick(performance.now());

    if (earthSpinning) earth.rotation.y += 0.0012;

    // Camera transition (disables controls internally during lerp)
    focusManager.update();

    // Selection ring follows focused body
    selectionViz.update(camera);

    // Celestial labels (screen-space projection)
    labelSystem.update();

    // Earth city hover
    const hoveredCity = hoverSystem.update(earth, showCities);
    if (hoveredCity) infoPanel.show(hoveredCity.userData);
    else             infoPanel.hide();

    // Lunar settlement hover — FIX: was calling private _raycastSettlements() instead
    if (showLunarSettlements && settlementMeshes.length > 0) {
        moon.updateMatrixWorld(true);
        moonHoverSystem.update(moon, showLunarSettlements);
    }

    // Satellite hover
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

// ─── Settlement Tooltip helpers ───────────────────────────────────────────────

function _showSettlementTooltip(mesh) {
    const d = mesh.userData;
    settlementTooltip.innerHTML = `
        <div class="stt-badge">PLANNED / PROPOSED</div>
        <div class="stt-name">${d.name}</div>
        <div class="stt-desc">${d.description}</div>
    `;
    settlementTooltip.style.display = 'block';
    settlementTooltip.style.left    = `${_lastMouseX + 16}px`;
    settlementTooltip.style.top     = `${_lastMouseY - 8}px`;
}

function _hideSettlementTooltip() {
    settlementTooltip.style.display = 'none';
}

// ─── Resize ───────────────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
    camera.updateAspect(window.innerWidth, window.innerHeight);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// ─── Cleanup ─────────────────────────────────────────────────────────────────

window.__disposeMoon = () => disposeMoon(moon);
