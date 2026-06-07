import * as THREE from 'three';

import { createScene } from './core/scene.js';
import { createCamera } from './core/camera.js';
import { createRenderer } from './core/renderer.js';

import { createEarth } from './earth/Earth.js';
import { addCity } from './earth/cities.js';

import capitals from './data/capitals.json';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {createCountryBorders} from "./earth/countryBorders.js";

//
// ==========================
// 🌍 SETUP
// ==========================
//

const scene = createScene();
const camera = createCamera();
const renderer = createRenderer();

camera.position.set(0, 0, 12);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enableZoom = true;

//
// ==========================
// 🌍 EARTH
// ==========================
//

const earth = createEarth();
scene.add(earth);

const borders = createCountryBorders();
earth.add(borders);

let earthSpinning = true;
let showCities = true;

//
// ==========================
// 📍 CITIES GROUP (IMPORTANT FIX)
// ==========================
//

const citiesGroup = new THREE.Group();
earth.add(citiesGroup);

const cityObjects = [];

const CITY_RADIUS = 5.02;

capitals.forEach((city) => {
    const obj = addCity(citiesGroup, city, CITY_RADIUS);

    obj.userData = {
        name: city.name,
        lat: city.lat,
        lon: city.lon
    };

    cityObjects.push(obj);
});

//
// ==========================
// 🖱️ MOUSE + RAYCASTER FIX
// ==========================
//

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let hovered = null;

window.addEventListener('mousemove', (event) => {up
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

function updateHover() {
    // 🔥 IMPORTANT: force matrix update BEFORE raycast
    earth.updateMatrixWorld(true);
    citiesGroup.updateMatrixWorld(true);

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(cityObjects, true);

    if (intersects.length > 0 && showCities) {
        const obj = intersects[0].object;

        if (hovered !== obj) {
            if (hovered) {
                hovered.material.color.set(0xff4444);
                hovered.scale.set(1, 1, 1);
            }

            hovered = obj;

            hovered.material.color.set(0x00ffcc);
            hovered.scale.set(1.6, 1.6, 1.6);
        }
    } else {
        if (hovered) {
            hovered.material.color.set(0xff4444);
            hovered.scale.set(1, 1, 1);
            hovered = null;
        }
    }
}

//
// ==========================
// 🎛️ UI TOGGLES (CHECKBOXES)
// ==========================
//

const ui = document.createElement('div');

ui.style.position = 'absolute';
ui.style.top = '12px';
ui.style.right = '12px';
ui.style.zIndex = '9999';

ui.style.color = 'white';
ui.style.background = 'rgba(0,0,0,0.55)';
ui.style.padding = '12px 14px';
ui.style.borderRadius = '10px';
ui.style.backdropFilter = 'blur(10px)';
ui.style.fontFamily = 'sans-serif';
ui.style.fontSize = '13px';

ui.innerHTML = `
  <label>
    <input type="checkbox" id="spinToggle" checked />
    Earth spinning
  </label>
  <br/><br/>
  <label>
    <input type="checkbox" id="citiesToggle" checked />
    Show capitals
  </label>
`;

document.body.appendChild(ui);

//
// ==========================
// 🎛️ UI LOGIC
// ==========================
//

document.getElementById('spinToggle').addEventListener('change', (e) => {
    earthSpinning = e.target.checked;
});

document.getElementById('citiesToggle').addEventListener('change', (e) => {
    showCities = e.target.checked;

    citiesGroup.visible = showCities;
});

//
// ==========================
// 🌍 ANIMATION LOOP
// ==========================
//

function animate() {
    requestAnimationFrame(animate);

    if (earthSpinning) {
        earth.rotation.y += 0.0015;
    }

    updateHover();

    controls.update();
    renderer.render(scene, camera);
}

animate();

//
// ==========================
// 📏 RESIZE
// ==========================
//

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
});