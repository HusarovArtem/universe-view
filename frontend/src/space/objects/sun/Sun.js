/**
 * Sun.js — animated photorealistic Sun.
 *
 * Visual layers:
 *   SunSurface     — photosphere: granulation cells, sunspots, limb darkening
 *   SunFlares      — chromosphere plasma loops at limb
 *   SunCoronaInner — structured corona with helmet streamers
 *   SunCoronaMid   — extended K-corona
 *   SunHalo        — soft outer diffuse K-corona
 *   SunGlow        — billboard sprite (wide additive yellow-white gradient)
 */

import * as THREE from 'three';

// ─── Placement / size ────────────────────────────────────────────────────────

export const SUN_SCENE_DISTANCE = 600;
export const SUN_VISUAL_RADIUS  = 65;

const _sunDir = new THREE.Vector3(50, 30, 80).normalize();

export const SUN_SCENE_POS = _sunDir.clone().multiplyScalar(SUN_SCENE_DISTANCE);

// ─── Shared noise ─────────────────────────────────────────────────────────────

const NOISE_GLSL = /* glsl */`
float _h(vec3 p){
    p=fract(p*0.1031); p+=dot(p,p.zyx+31.32);
    return fract((p.x+p.y)*p.z);
}
float vn(vec3 x){
    vec3 i=floor(x),f=fract(x);
    vec3 u=f*f*f*(f*(f*6.0-15.0)+10.0);
    return mix(
        mix(mix(_h(i),         _h(i+vec3(1,0,0)),u.x),
            mix(_h(i+vec3(0,1,0)),_h(i+vec3(1,1,0)),u.x),u.y),
        mix(mix(_h(i+vec3(0,0,1)),_h(i+vec3(1,0,1)),u.x),
            mix(_h(i+vec3(0,1,1)),_h(i+vec3(1,1,1)),u.x),u.y),
        u.z);
}
float fbm(vec3 p){
    float v=0.0,a=0.5;
    vec3 s=vec3(100.0);
    for(int i=0;i<7;i++){v+=a*vn(p);p=p*2.2+s;a*=0.46;}
    return v;
}
`;

// ─── Photosphere surface ──────────────────────────────────────────────────────

const SURF_VERT = /* glsl */`
varying vec3 vNorm;
varying vec3 vPos;
void main(){
    vPos  = position;
    vNorm = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}`;

const SURF_FRAG = /* glsl */`
${NOISE_GLSL}
uniform float uTime;
varying vec3  vNorm;
varying vec3  vPos;

void main(){
    vec3  p  = normalize(vPos);
    float t  = uTime * 0.016;

    // ── 1. Supergranulation (large convection cells, slow drift) ─────────────
    float supergran = fbm(p * 2.4 + t * 0.05);

    // ── 2. Granulation (high-frequency convection cells) ─────────────────────
    // Multiply two offset FBMs: bright only where BOTH are high → cell tops.
    // Product is zero at lane edges (where one or both are low).
    vec3 gp = p * 12.0;
    float g1 = fbm(gp + t * 0.72);
    float g2 = fbm(gp + vec3(3.9, 2.1, 0.8) + t * 0.60);
    float gran = clamp(pow(g1 * g2 * 5.5, 0.55), 0.0, 1.0);

    // ── 3. Plasma turbulence (domain-warped field lines) ─────────────────────
    vec3 pq = p * 4.2;
    vec3 q  = vec3(fbm(pq + t*0.50), fbm(pq + vec3(5.2,1.3,0.9) + t*0.45), 0.0);
    float plasma = fbm(pq + 0.85 * q.xyy + t * 0.12);

    // ── 4. Sunspot regions (slow-moving low-frequency blobs) ─────────────────
    float sn   = fbm(p * 5.0 + vec3(13.7, t * 0.18, 8.1));
    // Threshold: approximately 12–18% of surface becomes a sunspot
    float spot = 1.0 - smoothstep(0.555, 0.650, sn);

    // ── 5. Combine layers ────────────────────────────────────────────────────
    float n = gran * 0.50 + plasma * 0.28 + supergran * 0.22;
    n = clamp(n, 0.0, 1.0);
    n = pow(n, 0.65); // gamma-lift so most of the disc looks bright

    // Sunspots: drive brightness toward spot-umbra value
    n = mix(n, n * 0.16, spot * 0.85);

    // ── 6. Colour ramp ───────────────────────────────────────────────────────
    // High-contrast: dark intergranular lanes → vivid orange granule →
    //               bright yellow-white top → near-white peak
    vec3 cLane  = vec3(0.52, 0.13, 0.00); // dark intergranular lane
    vec3 cGran  = vec3(1.00, 0.60, 0.06); // granule body (vivid orange-yellow)
    vec3 cHot   = vec3(1.00, 0.90, 0.48); // hot granule top
    vec3 cPeak  = vec3(1.00, 0.99, 0.90); // near-white (like real ~5800 K)
    vec3 cSpot  = vec3(0.22, 0.05, 0.00); // sunspot umbra

    vec3 col;
    if      (n < 0.28) col = mix(cLane, cGran,  n / 0.28);
    else if (n < 0.60) col = mix(cGran, cHot,   (n - 0.28) / 0.32);
    else               col = mix(cHot,  cPeak,  (n - 0.60) / 0.40);

    // Blend sunspot colour
    col = mix(col, cSpot, spot * 0.82);

    // ── 7. Limb darkening (Eddington law: I=1−u(1−μ^β)) ─────────────────────
    // u = 0.72 (strong), β = 0.46 → edge goes visibly orange-red
    float mu   = clamp(dot(normalize(vNorm), vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
    float limb = 1.0 - 0.72 * (1.0 - pow(mu, 0.46));
    col *= limb;

    // ── 8. Faculae (bright chromospheric network, strongest near limb) ────────
    float fn  = fbm(p * 10.0 + vec3(t * 1.4, t * 0.9, t * 1.15));
    float fac = smoothstep(0.58, 0.76, fn) * (1.0 - mu * 0.75) * 2.4;
    col += vec3(0.48, 0.26, 0.07) * fac * (1.0 - spot * 0.6);

    // Hard emissive floor
    col = max(col, vec3(0.26, 0.09, 0.01));

    gl_FragColor = vec4(col, 1.0);
}`;

// ─── Corona / atmosphere shaders ─────────────────────────────────────────────

const CORONA_VERT = /* glsl */`
varying vec3 vNorm;
varying vec3 vPos;
void main(){
    vPos  = position;
    vNorm = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}`;

// Inner corona — structured helmet streamers + turbulence
const CORONA_INNER_FRAG = /* glsl */`
${NOISE_GLSL}
uniform float uTime;
uniform vec3  uColor;
uniform float uOpacity;
varying vec3  vNorm;
varying vec3  vPos;
void main(){
    float mu  = clamp(dot(normalize(vNorm),vec3(0,0,1)),0.0,1.0);
    float rim = pow(1.0-mu, 2.2);
    vec3  pos = normalize(vPos);
    float t   = uTime * 0.010;

    // Angular streamer belt (helmet streamers in the equatorial plane)
    float theta   = atan(pos.x, pos.z);
    float lat     = asin(clamp(pos.y, -1.0, 1.0));
    float latBelt = exp(-lat * lat * 4.0); // concentrated near equator
    float streamer= 0.45 + 0.55 * (0.5 + 0.5 * sin(theta * 4.5 + t * 1.8)) * latBelt;

    // Fine turbulence
    float cn = fbm(pos*2.8+t*0.38)*0.5 + fbm(pos*5.5-t*0.22)*0.3 + fbm(pos*11.0+t*0.52)*0.2;

    gl_FragColor = vec4(uColor, rim * (0.28 + 0.55*cn + 0.17*streamer) * uOpacity);
}`;

// Mid corona — broader wisps
const CORONA_MID_FRAG = /* glsl */`
${NOISE_GLSL}
uniform float uTime;
uniform vec3  uColor;
uniform float uOpacity;
varying vec3  vNorm;
varying vec3  vPos;
void main(){
    float mu  = clamp(dot(normalize(vNorm),vec3(0,0,1)),0.0,1.0);
    float rim = pow(1.0-mu, 3.5);
    vec3  pos = normalize(vPos);
    float t   = uTime * 0.008;
    float cn  = fbm(pos*1.6+t*0.28)*0.65 + fbm(pos*3.2+t*0.45)*0.35;
    gl_FragColor = vec4(uColor, rim*cn*uOpacity);
}`;

// Outer halo — soft K-corona with radial structure
const HALO_FRAG = /* glsl */`
${NOISE_GLSL}
uniform float uTime;
uniform vec3  uColor;
uniform float uOpacity;
varying vec3  vNorm;
varying vec3  vPos;
void main(){
    float mu  = clamp(dot(normalize(vNorm),vec3(0,0,1)),0.0,1.0);
    float rim = pow(1.0-mu, 5.5);
    vec3  pos = normalize(vPos);
    float theta   = atan(pos.x, pos.z);
    float bigWisp = 0.55 + 0.45 * abs(sin(theta * 3.0 + uTime * 0.004));
    float g = fbm(pos*1.0+uTime*0.005)*0.5+0.50;
    gl_FragColor = vec4(uColor, rim * g * bigWisp * uOpacity);
}`;

// Chromospheric flares / prominence loops
const FLARE_FRAG = /* glsl */`
${NOISE_GLSL}
uniform float uTime;
uniform vec3  uColor;
uniform float uOpacity;
varying vec3  vNorm;
varying vec3  vPos;
void main(){
    vec3  pos = normalize(vPos);
    float mu  = clamp(dot(normalize(vNorm),vec3(0,0,1)),0.0,1.0);
    float rim = pow(1.0-mu, 1.6);
    float t   = uTime * 0.032;
    float n1  = fbm(pos*11.0 + t*0.80);
    float n2  = fbm(pos*20.0 - t*1.15);
    float sp  = smoothstep(0.60,0.72,n1) * smoothstep(0.58,0.68,n2);
    gl_FragColor = vec4(uColor, sp * rim * 1.5 * uOpacity);
}`;

// ─── createSun ────────────────────────────────────────────────────────────────

export function createSun() {
    const group = new THREE.Group();
    group.name  = 'Sun';
    group.position.copy(SUN_SCENE_POS);

    const _layer = (frag, uniforms, radius, [seg1, seg2]) => {
        const mat  = new THREE.ShaderMaterial({ uniforms, vertexShader: CORONA_VERT, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide });
        const geo  = new THREE.SphereGeometry(radius, seg1, seg2);
        const mesh = new THREE.Mesh(geo, mat);
        return { mesh, geo, mat, uniforms };
    };

    // ── Surface (opaque, owns depth) ─────────────────────────────────────────
    const surfUni  = { uTime: { value: 0 } };
    const surfMat  = new THREE.ShaderMaterial({ uniforms: surfUni, vertexShader: SURF_VERT, fragmentShader: SURF_FRAG, side: THREE.FrontSide });
    const surfGeo  = new THREE.SphereGeometry(SUN_VISUAL_RADIUS, 128, 64);
    const surfMesh = new THREE.Mesh(surfGeo, surfMat);
    surfMesh.name  = 'SunSurface';
    group.add(surfMesh);

    // ── Plasma flares (just above surface) ───────────────────────────────────
    const cf = _layer(FLARE_FRAG,
        { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xffbb55) }, uOpacity: { value: 0.55 } },
        SUN_VISUAL_RADIUS * 1.08, [96, 48]);
    cf.mesh.name = 'SunFlares';
    group.add(cf.mesh);

    // ── Inner corona — structured streamers ───────────────────────────────────
    const ci = _layer(CORONA_INNER_FRAG,
        { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xffaa55) }, uOpacity: { value: 0.75 } },
        SUN_VISUAL_RADIUS * 1.40, [64, 32]);
    ci.mesh.name = 'SunCoronaInner';
    group.add(ci.mesh);

    // ── Mid corona ────────────────────────────────────────────────────────────
    const cm = _layer(CORONA_MID_FRAG,
        { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xff7700) }, uOpacity: { value: 0.30 } },
        SUN_VISUAL_RADIUS * 2.1, [48, 24]);
    cm.mesh.name = 'SunCoronaMid';
    group.add(cm.mesh);

    // ── Outer halo (K-corona) ────────────────────────────────────────────────
    const ch = _layer(HALO_FRAG,
        { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xff5500) }, uOpacity: { value: 0.10 } },
        SUN_VISUAL_RADIUS * 4.5, [32, 16]);
    ch.mesh.name = 'SunHalo';
    group.add(ch.mesh);

    // ── Glow sprite (yellow-white, tight to stay clean at distance) ───────────
    const glowSprite = _buildGlowSprite(SUN_VISUAL_RADIUS * 8);
    glowSprite.name  = 'SunGlow';
    group.add(glowSprite);

    // ── Directional light ─────────────────────────────────────────────────────
    const dir                 = new THREE.DirectionalLight(0xfff5e0, 1.9);
    dir.name                  = 'SunDirectionalLight';
    dir.position.copy(SUN_SCENE_POS);
    dir.target.position.set(0, 0, 0);
    dir.castShadow            = true;
    dir.shadow.mapSize.width  = 2048;
    dir.shadow.mapSize.height = 2048;
    dir.shadow.camera.near    = 480;
    dir.shadow.camera.far     = 1050;
    dir.shadow.camera.left    = -320;
    dir.shadow.camera.right   =  320;
    dir.shadow.camera.top     =  320;
    dir.shadow.camera.bottom  = -320;
    dir.shadow.bias           = -0.001;
    dir.shadow.normalBias     =  0.05;

    const ambient = new THREE.AmbientLight(0x112244, 0.85);
    ambient.name  = 'SpaceAmbient';

    const _unis = [surfUni, cf.uniforms, ci.uniforms, cm.uniforms, ch.uniforms];
    function update(elapsedSec) {
        for (let i = 0; i < _unis.length; i++) _unis[i].uTime.value = elapsedSec;
    }

    return { group, surfaceMesh: surfMesh, update, directionalLight: dir, ambientLight: ambient };
}

// ─── Glow sprite (yellow-white, additive) ────────────────────────────────────

function _buildGlowSprite(size) {
    const RES = 256;
    const cv  = document.createElement('canvas');
    cv.width = cv.height = RES;
    const ctx = cv.getContext('2d');
    const cx  = RES / 2;

    const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
    g.addColorStop(0.00, 'rgba(255,255,245,1.00)');
    g.addColorStop(0.04, 'rgba(255,252,200,0.92)');
    g.addColorStop(0.10, 'rgba(255,230,120,0.74)');
    g.addColorStop(0.22, 'rgba(255,180, 60,0.42)');
    g.addColorStop(0.42, 'rgba(230, 90,  5,0.16)');
    g.addColorStop(0.65, 'rgba(180, 45,  0,0.04)');
    g.addColorStop(1.00, 'rgba(  0,  0,  0,0.00)');

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, RES, RES);

    const tex      = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat      = new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.90 });
    const sprite   = new THREE.Sprite(mat);
    sprite.scale.setScalar(size);
    return sprite;
}
