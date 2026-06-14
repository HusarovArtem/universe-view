/**
 * Sun.js — animated, physically believable Sun.
 *
 * createSun() returns { group, update, directionalLight, ambientLight }
 *
 * Visual layers (back-to-front within the group):
 *   SunHalo        — large soft outer K-corona glow
 *   SunCoronaMid   — mid corona, animated wisps
 *   SunCoronaInner — tight chromosphere rim
 *   SunFlares      — limb plasma loop spots
 *   SunSurface     — animated photosphere (domain-warped FBM + limb darkening)
 *   SunGlow        — billboard sprite (wide additive radial gradient)
 *
 * Lighting:
 *   DirectionalLight at SUN_SCENE_POS, target origin (or Earth when orbiting).
 *   Shadow map 2048×2048, PCF, frustum covers Earth + lunar orbit from Sun.
 *
 * Scene placement:
 *   Direction preserved from original hardcoded (50,30,80).
 *   Distance: 600 scene units — farther and visually distinct from Earth/Moon system.
 *   Radius:   65 scene units  — larger, more imposing star.
 */

import * as THREE from 'three';

// ─── Position / size ──────────────────────────────────────────────────────────

export const SUN_SCENE_DISTANCE = 600;
export const SUN_VISUAL_RADIUS  = 65;

const _sunDir = new THREE.Vector3(50, 30, 80).normalize();

/** Sun world position — exported so main.js can reference without importing all. */
export const SUN_SCENE_POS = _sunDir.clone().multiplyScalar(SUN_SCENE_DISTANCE);

// ─── Shared noise GLSL ────────────────────────────────────────────────────────

const NOISE_GLSL = /* glsl */`
float _h(vec3 p) {
    p  = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
}
float vn(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    vec3 u = f*f*f*(f*(f*6.0-15.0)+10.0);
    return mix(
        mix(mix(_h(i),              _h(i+vec3(1,0,0)),u.x),
            mix(_h(i+vec3(0,1,0)), _h(i+vec3(1,1,0)),u.x),u.y),
        mix(mix(_h(i+vec3(0,0,1)), _h(i+vec3(1,0,1)),u.x),
            mix(_h(i+vec3(0,1,1)), _h(i+vec3(1,1,1)),u.x),u.y),
        u.z);
}
float fbm(vec3 p){
    float v=0.0,a=0.5;
    vec3 s=vec3(100.0);
    for(int i=0;i<6;i++){ v+=a*vn(p); p=p*2.3+s; a*=0.45; }
    return v;
}
`;

// ─── Surface shaders ─────────────────────────────────────────────────────────

const SURF_VERT = /* glsl */`
varying vec3 vNorm;
varying vec3 vPos;
void main(){
    vPos = position;
    vNorm = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}`;

const SURF_FRAG = /* glsl */`
${NOISE_GLSL}
uniform float uTime;
varying vec3 vNorm;
varying vec3 vPos;

void main(){
    vec3 p = normalize(vPos);
    float t = uTime * 0.018;

    // Two-level domain-warp for plasma convection
    vec3 pq = p * 3.2;
    vec3 q = vec3(
        fbm(pq + vec3(0.00,0.00,0.00) + t*0.65),
        fbm(pq + vec3(5.20,1.30,0.90) + t*0.50),
        fbm(pq + vec3(1.70,9.20,3.50) + t*0.75)
    );
    vec3 r = vec3(
        fbm(pq + 1.2*q + vec3(1.7,9.2,3.5) + t*0.35),
        fbm(pq + 1.2*q + vec3(8.3,2.8,5.1) + t*0.28),
        fbm(pq + 1.2*q + vec3(2.4,7.1,0.8) + t*0.42)
    );
    float plasma = fbm(pq + 1.2*r + t*0.15);

    // High-frequency granulation (solar convection cells)
    float gran = fbm(p * 13.0 + t*0.55);

    // Combined: bias toward brighter so most of the sun looks hot
    float n = clamp(plasma*0.55 + gran*0.45, 0.0, 1.0);
    n = pow(n, 0.75); // gamma-lift to push values higher overall

    // Colour ramp — warm, vivid, clearly solar
    vec3 cDark   = vec3(0.55, 0.18, 0.00); // deep granule intergranular lane
    vec3 cMid    = vec3(0.95, 0.52, 0.05); // granule body — saturated orange
    vec3 cHot    = vec3(1.00, 0.82, 0.32); // bright yellow centre
    vec3 cPeak   = vec3(1.00, 0.97, 0.82); // near-white hot spots

    vec3 col;
    if      (n < 0.25) col = mix(cDark,  cMid,  n/0.25);
    else if (n < 0.55) col = mix(cMid,   cHot,  (n-0.25)/0.30);
    else               col = mix(cHot,   cPeak, (n-0.55)/0.45);

    // Limb darkening: I(μ)=1−u(1−μ^α), u=0.55, α=0.55
    float mu   = clamp(dot(normalize(vNorm), vec3(0,0,1)), 0.0, 1.0);
    float limb = 1.0 - 0.55*(1.0 - pow(mu, 0.55));
    col *= limb;

    // Faculae: bright active-region patches near the limb
    float fn  = fbm(p*7.0 + vec3(t*1.1, t*0.8, t*0.95));
    float fac = smoothstep(0.63, 0.80, fn) * (1.0-mu) * 1.4;
    col += vec3(0.35, 0.20, 0.04) * fac;

    // Hard floor: sun always emits orange-red even in "dark" cells
    col = max(col, vec3(0.22, 0.08, 0.0));

    gl_FragColor = vec4(col, 1.0);
}`;

// ─── Corona shaders ───────────────────────────────────────────────────────────

const CORONA_VERT = /* glsl */`
varying vec3 vNorm;
varying vec3 vPos;
void main(){
    vPos = position;
    vNorm = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}`;

const CORONA_INNER_FRAG = /* glsl */`
${NOISE_GLSL}
uniform float uTime;
uniform vec3  uColor;
uniform float uOpacity;
varying vec3 vNorm;
varying vec3 vPos;
void main(){
    float mu  = clamp(dot(normalize(vNorm),vec3(0,0,1)),0.0,1.0);
    float rim = pow(1.0-mu, 2.5);
    vec3 pos = normalize(vPos);
    float t  = uTime*0.012;
    float cn = fbm(pos*2.0+t*0.40)*0.55 + fbm(pos*4.5-t*0.25)*0.30 + fbm(pos*9.0+t*0.55)*0.15;
    gl_FragColor = vec4(uColor, rim*(0.40+0.60*cn)*uOpacity);
}`;

const CORONA_MID_FRAG = /* glsl */`
${NOISE_GLSL}
uniform float uTime;
uniform vec3  uColor;
uniform float uOpacity;
varying vec3 vNorm;
varying vec3 vPos;
void main(){
    float mu  = clamp(dot(normalize(vNorm),vec3(0,0,1)),0.0,1.0);
    float rim = pow(1.0-mu, 3.2);
    vec3 pos = normalize(vPos);
    float t  = uTime*0.009;
    float cn = fbm(pos*1.5+t*0.30)*0.7 + fbm(pos*3.0+t*0.50)*0.3;
    gl_FragColor = vec4(uColor, rim*cn*uOpacity);
}`;

const HALO_FRAG = /* glsl */`
${NOISE_GLSL}
uniform float uTime;
uniform vec3  uColor;
uniform float uOpacity;
varying vec3 vNorm;
varying vec3 vPos;
void main(){
    float mu  = clamp(dot(normalize(vNorm),vec3(0,0,1)),0.0,1.0);
    float rim = pow(1.0-mu, 5.0);
    float g   = fbm(normalize(vPos)*1.1+uTime*0.007)*0.45+0.55;
    gl_FragColor = vec4(uColor, rim*g*uOpacity);
}`;

const FLARE_FRAG = /* glsl */`
${NOISE_GLSL}
uniform float uTime;
uniform vec3  uColor;
uniform float uOpacity;
varying vec3 vNorm;
varying vec3 vPos;
void main(){
    vec3  pos = normalize(vPos);
    float mu  = clamp(dot(normalize(vNorm),vec3(0,0,1)),0.0,1.0);
    float rim = pow(1.0-mu, 1.4);
    float t   = uTime*0.035;
    float n1  = fbm(pos*10.0 + t*0.75);
    float n2  = fbm(pos*18.0 - t*1.10);
    float sp  = smoothstep(0.58,0.74,n1)*smoothstep(0.56,0.70,n2);
    gl_FragColor = vec4(uColor, sp*rim*1.3*uOpacity);
}`;

// ─── createSun ────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SunResult
 * @property {THREE.Group}            group
 * @property {THREE.Mesh}             surfaceMesh   — pick target for body registry
 * @property {function(number): void} update        — call each frame with elapsed seconds
 * @property {THREE.DirectionalLight} directionalLight
 * @property {THREE.AmbientLight}     ambientLight
 */

/** @returns {SunResult} */
export function createSun() {
    const group = new THREE.Group();
    group.name  = 'Sun';
    group.position.copy(SUN_SCENE_POS);

    // Helper: build a ShaderMaterial layer
    const _layer = (vert, frag, uniforms, radius, segments, side = THREE.FrontSide) => {
        const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, side, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        const geo = new THREE.SphereGeometry(radius, segments[0], segments[1]);
        const mesh = new THREE.Mesh(geo, mat);
        return { mesh, geo, mat, uniforms };
    };

    // ── 1. Surface (opaque, no additive — draws depth correctly) ──────────────
    const surfUni  = { uTime: { value: 0 } };
    const surfMat  = new THREE.ShaderMaterial({ uniforms: surfUni, vertexShader: SURF_VERT, fragmentShader: SURF_FRAG });
    const surfGeo  = new THREE.SphereGeometry(SUN_VISUAL_RADIUS, 128, 64);
    const surfMesh = new THREE.Mesh(surfGeo, surfMat);
    surfMesh.name  = 'SunSurface';
    group.add(surfMesh);

    // ── 2. Inner corona ───────────────────────────────────────────────────────
    const ci = _layer(CORONA_VERT, CORONA_INNER_FRAG,
        { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xff9944) }, uOpacity: { value: 0.70 } },
        SUN_VISUAL_RADIUS * 1.42, [64, 32]);
    ci.mesh.name = 'SunCoronaInner';
    group.add(ci.mesh);

    // ── 3. Mid corona ─────────────────────────────────────────────────────────
    const cm = _layer(CORONA_VERT, CORONA_MID_FRAG,
        { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xff6600) }, uOpacity: { value: 0.32 } },
        SUN_VISUAL_RADIUS * 2.2, [48, 24]);
    cm.mesh.name = 'SunCoronaMid';
    group.add(cm.mesh);

    // ── 4. Outer halo (K-corona) ──────────────────────────────────────────────
    const ch = _layer(CORONA_VERT, HALO_FRAG,
        { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xff4400) }, uOpacity: { value: 0.11 } },
        SUN_VISUAL_RADIUS * 5.0, [32, 16]);
    ch.mesh.name = 'SunHalo';
    group.add(ch.mesh);

    // ── 5. Flare layer (plasma loops at limb) ─────────────────────────────────
    const cf = _layer(CORONA_VERT, FLARE_FRAG,
        { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xffaa44) }, uOpacity: { value: 0.50 } },
        SUN_VISUAL_RADIUS * 1.10, [96, 48]);
    cf.mesh.name = 'SunFlares';
    group.add(cf.mesh);

    // ── 6. Wide glow sprite — 10× keeps it visible without flooding the scene
    const glowSprite = _buildGlowSprite(SUN_VISUAL_RADIUS * 10);
    glowSprite.name  = 'SunGlow';
    group.add(glowSprite);

    // ── Directional light ─────────────────────────────────────────────────────
    const dir      = new THREE.DirectionalLight(0xfff5e0, 1.8);
    dir.name       = 'SunDirectionalLight';
    dir.position.copy(SUN_SCENE_POS);
    dir.target.position.set(0, 0, 0);

    dir.castShadow                = true;
    dir.shadow.mapSize.width      = 2048;
    dir.shadow.mapSize.height     = 2048;
    dir.shadow.camera.near        = 480;  // just inside Sun→Earth distance
    dir.shadow.camera.far         = 1050; // past Moon (Earth + 302 units + margin)
    dir.shadow.camera.left        = -320;
    dir.shadow.camera.right       =  320;
    dir.shadow.camera.top         =  320;
    dir.shadow.camera.bottom      = -320;
    dir.shadow.bias               = -0.001;
    dir.shadow.normalBias         = 0.05;

    // ── Ambient ───────────────────────────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0x112244, 0.9);
    ambient.name  = 'SpaceAmbient';

    // ── Uniform update list ───────────────────────────────────────────────────
    const _unis = [surfUni, ci.uniforms, cm.uniforms, ch.uniforms, cf.uniforms];

    function update(elapsedSec) {
        for (let i = 0; i < _unis.length; i++) _unis[i].uTime.value = elapsedSec;
    }

    // ── Dispose ───────────────────────────────────────────────────────────────
    group.userData.dispose = () => {
        surfGeo.dispose(); surfMat.dispose();
        [ci, cm, ch, cf].forEach(l => { l.geo.dispose(); l.mat.dispose(); });
        if (glowSprite.material.map) glowSprite.material.map.dispose();
        glowSprite.material.dispose();
    };

    return { group, surfaceMesh: surfMesh, update, directionalLight: dir, ambientLight: ambient };
}

// ─── Glow sprite ─────────────────────────────────────────────────────────────

function _buildGlowSprite(size) {
    const RES = 256;
    const cv  = document.createElement('canvas');
    cv.width  = cv.height = RES;
    const ctx = cv.getContext('2d');
    const cx  = RES / 2;

    const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
    g.addColorStop(0.00, 'rgba(255,255,230,0.98)');
    g.addColorStop(0.04, 'rgba(255,240,160,0.90)');
    g.addColorStop(0.10, 'rgba(255,180, 60,0.72)');
    g.addColorStop(0.22, 'rgba(255,120, 20,0.40)');
    g.addColorStop(0.42, 'rgba(220, 70,  0,0.15)');
    g.addColorStop(0.65, 'rgba(180, 40,  0,0.04)');
    g.addColorStop(1.00, 'rgba(  0,  0,  0,0.00)');

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, RES, RES);

    const tex       = new THREE.CanvasTexture(cv);
    tex.colorSpace  = THREE.SRGBColorSpace;
    const mat       = new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.88 });
    const sprite    = new THREE.Sprite(mat);
    sprite.scale.setScalar(size);
    return sprite;
}
