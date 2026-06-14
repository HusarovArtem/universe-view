/**
 * main.js — Universe View Stage 4: Solar System
 *
 * Key changes vs Stage 3:
 *  1. Animated Sun (FBM photosphere, sunspots, helmet-streamer corona)
 *  2. earthSystem group — Earth/Moon/satellites move as a unit to orbit the Sun
 *  3. Earth orbit toggle — no FocusManager involved (controls always usable)
 *  4. Unified collapsible controls panel (satellites embedded, no separate overlay)
 *  5. Sun clickable + SUN_INFO panel
 *  6. Auto-expands the focused body's section in the controls panel
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

import { TimeControlPanel }  from './ui/controls/TimeControlPanel.js';
import { SatelliteTooltip }  from './ui/panels/SatelliteTooltip.js';

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

const { group: sunGroup, surfaceMesh: sunSurfaceMesh, update: updateSun,
        directionalLight: sunLight, ambientLight: sunAmbient } = createSun();

scene.add(sunGroup);
scene.add(sunLight);
scene.add(sunLight.target);
scene.add(sunAmbient);

const _sunStartMs = performance.now();

// ─── Earth System Group ───────────────────────────────────────────────────────
// Earth, Moon, satellites, orbit lines are children of this group.
// When Earth orbit is on, this group's position moves around the Sun.

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
controls.maxDistance   = 800;
controls.enablePan     = false;
controls.rotateSpeed   = 0.5;
controls.zoomSpeed     = 0.8;

// ─── Celestial Body Registry ──────────────────────────────────────────────────

const bodyRegistry = new CelestialBodyRegistry();

bodyRegistry.register({
    id: 'earth', name: 'Earth',
    group: earth, pickMesh: earth.getObjectByName('EarthSurface') ?? earth,
    radius: EARTH_RADIUS, info: EARTH_INFO, type: 'planet',
});

bodyRegistry.register({
    id: 'moon', name: 'Moon',
    group: moon, pickMesh: moon.getObjectByName('MoonSurface') ?? moon,
    radius: MOON_RADIUS_SCENE, info: MOON_INFO, type: 'moon',
});

bodyRegistry.register({
    id: 'sun', name: 'Sun',
    group: sunGroup, pickMesh: sunSurfaceMesh,
    radius: SUN_VISUAL_RADIUS, info: SUN_INFO, type: 'star',
});

// ─── Focus Manager ────────────────────────────────────────────────────────────

const focusManager = new FocusManager(camera, controls);
focusManager.focusBody(bodyRegistry.get('earth'));

// ─── Selection Visualizer ─────────────────────────────────────────────────────

const selectionViz = new SelectionVisualizer(scene);
selectionViz.setBody(bodyRegistry.get('earth'));

// ─── Orbit / Label Systems ────────────────────────────────────────────────────

const moonOrbitViz   = new OrbitVisualizer(earthSystem);
let   moonOrbitVisible = false;

const labelSystem = new CelestialLabelSystem(camera, renderer);
labelSystem.register({ id: 'earth-label', group: earth,    title: 'EARTH', subtitle: 'Population: 8.1B',           radius: EARTH_RADIUS      });
labelSystem.register({ id: 'moon-label',  group: moon,     title: 'MOON',  subtitle: 'Natural Satellite',          radius: MOON_RADIUS_SCENE });
labelSystem.register({ id: 'sun-label',   group: sunGroup, title: 'SUN',   subtitle: 'G-Type Main-Sequence Star',  radius: SUN_VISUAL_RADIUS });

// ─── Celestial Info Panel ─────────────────────────────────────────────────────

const celestialInfoPanel = new CelestialInfoPanel();
celestialInfoPanel.show(bodyRegistry.get('earth'));

// Section IDs auto-expanded when a body is focused
const _sectionForBody = { earth: 'secEarth', moon: 'secMoon', sun: 'secSun' };
const _focusBtnIds    = { earth: 'focusEarth', moon: 'focusMoon', sun: 'focusSun' };

focusManager.onFocusChange(({ to }) => {
    if (!to) return;

    celestialInfoPanel.show(to);
    selectionViz.setBody(to);

    // Update active focus button
    document.querySelectorAll('.focus-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(_focusBtnIds[to.id])?.classList.add('active');

    // Auto-expand the relevant controls section
    const secId = _sectionForBody[to.id];
    if (secId) document.getElementById(secId).open = true;
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
    if (body) { _activateFocus(body.id); infoPanel.hide(); }
});

// ─── Satellite Systems ────────────────────────────────────────────────────────

const satelliteModule   = new SatelliteModule(timeEngine);
const satelliteRenderer = new SatelliteRenderer(earthSystem, renderer.domElement);
const orbitRenderer     = new OrbitRenderer(earthSystem);

let orbitsEnabled = false;

satelliteModule.onUpdate((satellites) => { satelliteRenderer.update(satellites); });

// Satellite controls — now wired directly to elements in #controlsPanel
document.getElementById('satVisible').addEventListener('change', (e) => {
    satelliteRenderer.setVisible(e.target.checked);
});

document.getElementById('satOrbits').addEventListener('change', (e) => {
    orbitsEnabled = e.target.checked;
    if (orbitsEnabled) {
        for (const sat of satelliteModule.satellites.values())
            orbitRenderer.showOrbit(sat, timeEngine.simTimeMs);
    } else {
        orbitRenderer.dispose();
    }
});

document.getElementById('satLoad').addEventListener('click', async () => {
    const group    = document.getElementById('satGroup').value;
    const statusEl = document.getElementById('scStatus');
    const countEl  = document.getElementById('scCount');
    statusEl.textContent = 'Loading…';
    statusEl.style.color = '';
    try {
        const n = await satelliteModule.load(group);
        countEl.textContent  = `${n.toLocaleString()} objects`;
        statusEl.textContent = `Loaded ${n} satellites`;
        statusEl.style.color = '#00ffe0';
        if (orbitsEnabled) {
            orbitRenderer.dispose();
            for (const sat of satelliteModule.satellites.values())
                orbitRenderer.showOrbit(sat, timeEngine.simTimeMs);
        }
    } catch (err) {
        statusEl.textContent = `Error: ${err.message}`;
        statusEl.style.color = '#ff4455';
        console.error('[Satellites] Load failed:', err);
    }
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

// ─── Lunar Settlement Hover ───────────────────────────────────────────────────

const settlementTooltip = document.getElementById('settlementTooltip');

const moonHoverSystem = new HoverSystem(camera, renderer.domElement, {
    onEnter: (mesh) => { highlightSettlement(mesh); _showSettlementTooltip(mesh); },
    onLeave: (mesh) => { resetSettlement(mesh);     _hideSettlementTooltip();     },
});

buildLunarSettlements();

// ─── Layer Toggle State ───────────────────────────────────────────────────────

let earthSpinning   = true;
let showCities      = true;
let showEarthLabels = true;
let showMoonLabels  = true;
let showSunLabel    = true;

document.getElementById('spinToggle').addEventListener('change',    (e) => { earthSpinning = e.target.checked; });
document.getElementById('atmosphereToggle').addEventListener('change', (e) => setAtmosphereVisible(earth, e.target.checked));

document.getElementById('citiesToggle').addEventListener('change',  (e) => {
    showCities = e.target.checked;
    earthCitiesGroup.visible = showCities;
    if (!showCities) infoPanel.hide();
});

document.getElementById('moonOrbitToggle').addEventListener('change', (e) => {
    moonOrbitVisible = e.target.checked;
    if (moonOrbitVisible) moonOrbitViz.showOrbit(MOON_ORBITAL_PARAMS);
    else                  moonOrbitViz.dispose();
});

document.getElementById('earthLabelsToggle').addEventListener('change',  (e) => { showEarthLabels = e.target.checked; labelSystem.setVisible('earth-label', showEarthLabels); });
document.getElementById('moonLabelsToggle').addEventListener('change',   (e) => { showMoonLabels  = e.target.checked; labelSystem.setVisible('moon-label',  showMoonLabels);  });
document.getElementById('sunLabelToggle').addEventListener('change',     (e) => { showSunLabel    = e.target.checked; labelSystem.setVisible('sun-label',   showSunLabel);    });

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
        if (!earthOrbitEnabled) controls.maxDistance = 800;
    }
    focusManager.focusBody(bodyRegistry.get(bodyId));
}

document.getElementById('focusEarth').addEventListener('click', () => _activateFocus('earth'));
document.getElementById('focusMoon').addEventListener('click',  () => _activateFocus('moon'));
document.getElementById('focusSun').addEventListener('click',   () => _activateFocus('sun'));

document.getElementById('focusEarth').classList.add('active');

// ─── Earth Orbit ──────────────────────────────────────────────────────────────
//
// IMPORTANT: we do NOT use focusManager.focusBody() here.
// focusBody() disables OrbitControls during the lerp, and because Earth keeps
// moving the lerp never converges → controls stay disabled forever.
// Instead we directly update controls.target each frame to follow Earth,
// keeping OrbitControls fully functional the whole time.

const EARTH_ORBIT_RADIUS = 150;   // scene units from Sun
const EARTH_ORBIT_PERIOD = 120_000; // ms — 2 min per orbit

let earthOrbitEnabled  = false;
let _earthOrbitStartMs = 0;
let _earthOrbitRing    = null;
const _earthWorldPos   = new THREE.Vector3();
const _earthPrevPos    = new THREE.Vector3();

document.getElementById('earthOrbitToggle').addEventListener('change', (e) => {
    earthOrbitEnabled = e.target.checked;

    if (earthOrbitEnabled) {
        // Choose initAngle so Earth starts at orbit point closest to world origin.
        // That point is in the direction from Sun toward origin.
        const initAngle = Math.atan2(-SUN_SCENE_POS.z, -SUN_SCENE_POS.x);
        const normAngle = ((initAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        _earthOrbitStartMs = performance.now() - (normAngle / (Math.PI * 2)) * EARTH_ORBIT_PERIOD;

        // Compute initial Earth position and move the group there now
        const a0 = normAngle;
        earthSystem.position.set(
            SUN_SCENE_POS.x + EARTH_ORBIT_RADIUS * Math.cos(a0),
            SUN_SCENE_POS.y,
            SUN_SCENE_POS.z + EARTH_ORBIT_RADIUS * Math.sin(a0),
        );

        controls.target.copy(earthSystem.position);
        _earthPrevPos.copy(earthSystem.position);
        controls.maxDistance = 2000;
        // Cancel any in-progress FocusManager transition so controls stay enabled
        focusManager.cancelFocus();

        // Earth orbit path ring
        _earthOrbitRing = _buildEarthOrbitRing();
        scene.add(_earthOrbitRing);

    } else {
        // Restore Earth to world origin
        earthSystem.position.set(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.maxDistance = 800;
        focusManager.cancelFocus();

        // Restore sun shadow camera
        sunLight.target.position.set(0, 0, 0);
        sunLight.target.updateMatrixWorld();
        sunLight.shadow.camera.near = 480;
        sunLight.shadow.camera.far  = 1050;
        sunLight.shadow.camera.updateProjectionMatrix();

        if (_earthOrbitRing) {
            _earthOrbitRing.geometry.dispose();
            _earthOrbitRing.material.dispose();
            scene.remove(_earthOrbitRing);
            _earthOrbitRing = null;
        }
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
    const mat = new THREE.LineBasicMaterial({ color: 0x2244cc, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending });
    return new THREE.Line(geo, mat);
}

// ─── Tooltip mouse tracking ───────────────────────────────────────────────────

let _lastMouseX = 0, _lastMouseY = 0;

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
        const nextX   = SUN_SCENE_POS.x + EARTH_ORBIT_RADIUS * Math.cos(angle);
        const nextZ   = SUN_SCENE_POS.z + EARTH_ORBIT_RADIUS * Math.sin(angle);

        if (!focusManager.isTransitioning) {
            // Move camera by same delta as Earth so the orbit pivot stays stable
            const dx = nextX - _earthPrevPos.x;
            const dz = nextZ - _earthPrevPos.z;
            camera.position.x += dx;
            camera.position.z += dz;
            controls.target.x  = nextX;
            controls.target.y  = SUN_SCENE_POS.y;
            controls.target.z  = nextZ;
        }

        earthSystem.position.set(nextX, SUN_SCENE_POS.y, nextZ);
        _earthPrevPos.set(nextX, SUN_SCENE_POS.y, nextZ);

        // Update sun light direction toward Earth
        sunLight.target.position.copy(earthSystem.position);
        sunLight.target.updateMatrixWorld();
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
