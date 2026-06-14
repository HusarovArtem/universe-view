/**
 * main.js — Universe View Stage 4: Sun, Earth Orbit, Solar System
 *
 * Stage 4 adds:
 *  1. Animated Sun (FBM photosphere + corona + glow) — moved to 600 scene units
 *  2. Sun-driven DirectionalLight with shadow mapping (eclipse-capable)
 *  3. Clickable Sun registered in CelestialBodyRegistry
 *  4. earthSystem group — Earth/Moon/satellites share a movable root so they
 *     can orbit the visual Sun as a unit
 *  5. Earth orbit toggle — animates earthSystem around SUN_SCENE_POS
 *  6. Updated controls panel: ☀ SUN focus button, SUN LABEL, EARTH ORBIT toggles
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
import { CelestialInfoPanel, EARTH_INFO, MOON_INFO, SUN_INFO } from './ui/CelestialInfoPanel.js';

import capitals         from './data/capitals.json';
import lunarSettlements from './data/lunar_settlements.json';
import { createSun, SUN_SCENE_POS, SUN_VISUAL_RADIUS } from './space/objects/sun/Sun.js';

// ─── Core ─────────────────────────────────────────────────────────────────────

const scene    = createScene();
const camera   = createCamera();
const renderer = createRenderer();

// ─── Sun & Lighting ───────────────────────────────────────────────────────────

const {
    group:            sunGroup,
    surfaceMesh:      sunSurfaceMesh,
    update:           updateSun,
    directionalLight: sunLight,
    ambientLight:     sunAmbient,
} = createSun();

scene.add(sunGroup);
scene.add(sunLight);
scene.add(sunLight.target);
scene.add(sunAmbient);

const _sunStartMs = performance.now();

// ─── Earth System Group ───────────────────────────────────────────────────────
// Earth, Moon, satellites, and orbit lines are all children of earthSystem so
// they move as a unit when Earth orbits the Sun.

const earthSystem = new THREE.Group();
earthSystem.name  = 'EarthSystem';
scene.add(earthSystem);

// ─── Earth ────────────────────────────────────────────────────────────────────

const earth = createEarth();
earthSystem.add(earth);

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
earthSystem.add(moon);

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

bodyRegistry.register({
    id:       'sun',
    name:     'Sun',
    group:    sunGroup,
    pickMesh: sunSurfaceMesh,
    radius:   SUN_VISUAL_RADIUS,
    info:     SUN_INFO,
    type:     'star',
});

// ─── Focus Manager ────────────────────────────────────────────────────────────

const focusManager = new FocusManager(camera, controls);
focusManager.focusBody(bodyRegistry.get('earth'));

// ─── Selection Visualizer ─────────────────────────────────────────────────────

const selectionViz = new SelectionVisualizer(scene);
selectionViz.setBody(bodyRegistry.get('earth'));

// ─── Orbit Visualizer ─────────────────────────────────────────────────────────

const moonOrbitViz  = new OrbitVisualizer(earthSystem);
let moonOrbitVisible = false;

// ─── Celestial Labels ─────────────────────────────────────────────────────────

const labelSystem = new CelestialLabelSystem(camera, renderer);

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

labelSystem.register({
    id:       'sun-label',
    group:    sunGroup,
    title:    'SUN',
    subtitle: 'G-Type Main-Sequence Star',
    radius:   SUN_VISUAL_RADIUS,
});

// ─── Celestial Info Panel ─────────────────────────────────────────────────────

const celestialInfoPanel = new CelestialInfoPanel();
celestialInfoPanel.show(bodyRegistry.get('earth'));

const _focusBtnIds = { earth: 'focusEarth', moon: 'focusMoon', sun: 'focusSun' };

focusManager.onFocusChange(({ to }) => {
    if (to) {
        celestialInfoPanel.show(to);
        selectionViz.setBody(to);

        document.querySelectorAll('.focus-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(_focusBtnIds[to.id]);
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
    const dx = e.clientX - _pointerDownX;
    const dy = e.clientY - _pointerDownY;
    if (Math.sqrt(dx * dx + dy * dy) > 4) return;

    const rect = renderer.domElement.getBoundingClientRect();
    _clickNDC.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    _clickNDC.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;

    const body = bodyRegistry.pickBody(_clickNDC, camera);
    if (body) {
        _activateFocus(body.id);
        infoPanel.hide();
    }
});

// ─── Satellite Systems ────────────────────────────────────────────────────────

const satelliteModule   = new SatelliteModule(timeEngine);
const satelliteRenderer = new SatelliteRenderer(earthSystem, renderer.domElement);
const orbitRenderer     = new OrbitRenderer(earthSystem);

let orbitsEnabled = false;

satelliteModule.onUpdate((satellites) => {
    satelliteRenderer.update(satellites);
});

// ─── UI Systems ───────────────────────────────────────────────────────────────

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

buildLunarSettlements();

// ─── Layer Toggle State ───────────────────────────────────────────────────────

let earthSpinning   = true;
let showCities      = true;
let showEarthLabels = true;
let showMoonLabels  = true;
let showSunLabel    = true;

document.getElementById('spinToggle').addEventListener('change', (e) => {
    earthSpinning = e.target.checked;
});

document.getElementById('citiesToggle').addEventListener('change', (e) => {
    showCities               = e.target.checked;
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

document.getElementById('sunLabelToggle').addEventListener('change', (e) => {
    showSunLabel = e.target.checked;
    labelSystem.setVisible('sun-label', showSunLabel);
});

document.getElementById('lunarSettlementsToggle').addEventListener('change', (e) => {
    showLunarSettlements         = e.target.checked;
    moonSettlementsGroup.visible = showLunarSettlements;
});

// ─── Focus Buttons ────────────────────────────────────────────────────────────

function _activateFocus(bodyId) {
    if (bodyId === 'sun') {
        controls.minDistance = SUN_VISUAL_RADIUS * 1.2;
        controls.maxDistance = 2000;
    } else {
        controls.minDistance = 4.5;
        controls.maxDistance = 600;
    }
    focusManager.focusBody(bodyRegistry.get(bodyId));
}

document.getElementById('focusEarth').addEventListener('click', () => _activateFocus('earth'));
document.getElementById('focusMoon').addEventListener('click',  () => _activateFocus('moon'));
document.getElementById('focusSun').addEventListener('click',   () => _activateFocus('sun'));

document.getElementById('focusEarth').classList.add('active');

// ─── Earth Orbit ──────────────────────────────────────────────────────────────

const EARTH_ORBIT_RADIUS = 150;
const EARTH_ORBIT_PERIOD = 120_000; // ms — 2 min per full orbit

let earthOrbitEnabled  = false;
let _earthOrbitStartMs = 0;
let _earthOrbitRing    = null;

document.getElementById('earthOrbitToggle').addEventListener('change', (e) => {
    earthOrbitEnabled = e.target.checked;

    if (earthOrbitEnabled) {
        // Choose initAngle so Earth starts at the orbit point closest to world origin.
        // That point lies in the direction from Sun toward origin: angle = atan2(-z,-x).
        const initAngle = Math.atan2(-SUN_SCENE_POS.z, -SUN_SCENE_POS.x);
        // normalise to [0, 2π) so elapsed is positive
        const normAngle = ((initAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        _earthOrbitStartMs = performance.now() - (normAngle / (Math.PI * 2)) * EARTH_ORBIT_PERIOD;

        controls.maxDistance = 2000;

        // Build and add orbit ring (world-space circle around Sun)
        _earthOrbitRing = _buildEarthOrbitRing();
        scene.add(_earthOrbitRing);

        // Auto-focus Earth so camera follows it into orbital position
        _activateFocus('earth');

    } else {
        // Restore Earth + Moon to world origin
        earthSystem.position.set(0, 0, 0);

        // Restore sun shadow camera to default Earth-at-origin values
        sunLight.target.position.set(0, 0, 0);
        sunLight.target.updateMatrixWorld();
        sunLight.shadow.camera.near = 480;
        sunLight.shadow.camera.far  = 1050;
        sunLight.shadow.camera.updateProjectionMatrix();

        controls.maxDistance = 600;

        if (_earthOrbitRing) {
            _earthOrbitRing.geometry.dispose();
            _earthOrbitRing.material.dispose();
            scene.remove(_earthOrbitRing);
            _earthOrbitRing = null;
        }

        // Re-focus Earth at origin
        _activateFocus('earth');
    }
});

function _buildEarthOrbitRing() {
    const N   = 128;
    const pts = [];
    for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        pts.push(new THREE.Vector3(
            SUN_SCENE_POS.x + EARTH_ORBIT_RADIUS * Math.cos(a),
            SUN_SCENE_POS.y,
            SUN_SCENE_POS.z + EARTH_ORBIT_RADIUS * Math.sin(a),
        ));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
        color:       0x2244bb,
        transparent: true,
        opacity:     0.28,
        depthWrite:  false,
        blending:    THREE.AdditiveBlending,
    });
    return new THREE.Line(geo, mat);
}

// ─── Tooltip mouse tracking ───────────────────────────────────────────────────

let _lastMouseX = 0;
let _lastMouseY = 0;

renderer.domElement.addEventListener('mousemove', (e) => {
    _lastMouseX = e.clientX;
    _lastMouseY = e.clientY;
    if (settlementTooltip.style.display !== 'none') {
        settlementTooltip.style.left = `${_lastMouseX + 16}px`;
        settlementTooltip.style.top  = `${_lastMouseY - 8}px`;
    }
});

// ─── Animation Loop ───────────────────────────────────────────────────────────

function animate() {
    requestAnimationFrame(animate);

    timeEngine.tick(performance.now());

    updateSun((performance.now() - _sunStartMs) * 0.001);

    if (earthSpinning) earth.rotation.y += 0.0012;

    // Earth orbit around Sun
    if (earthOrbitEnabled) {
        const elapsed = performance.now() - _earthOrbitStartMs;
        const angle   = (elapsed / EARTH_ORBIT_PERIOD) * Math.PI * 2;
        earthSystem.position.set(
            SUN_SCENE_POS.x + EARTH_ORBIT_RADIUS * Math.cos(angle),
            SUN_SCENE_POS.y,
            SUN_SCENE_POS.z + EARTH_ORBIT_RADIUS * Math.sin(angle),
        );
        // Keep directional light aimed from Sun toward Earth each frame
        sunLight.target.position.copy(earthSystem.position);
        sunLight.target.updateMatrixWorld();
        // Adjust shadow camera: Earth is ~150 units from Sun
        sunLight.shadow.camera.near = 80;
        sunLight.shadow.camera.far  = 600;
        sunLight.shadow.camera.updateProjectionMatrix();
    }

    focusManager.update();
    selectionViz.update(camera);
    labelSystem.update();

    const hoveredCity = hoverSystem.update(earth, showCities);
    if (hoveredCity) infoPanel.show(hoveredCity.userData);
    else             infoPanel.hide();

    if (showLunarSettlements && settlementMeshes.length > 0) {
        moon.updateMatrixWorld(true);
        moonHoverSystem.update(moon, showLunarSettlements);
    }

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
