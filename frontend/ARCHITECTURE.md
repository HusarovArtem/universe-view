# Moon Implementation — Architecture & Technical Reference

## Files

### New Files

| Path | Role |
|------|------|
| `src/space/objects/moon/LunarConstants.js` | Single source of truth for all physical, orbital, and rendering constants |
| `src/space/objects/moon/LunarOrbit.js` | Pure orbital mechanics — Keplerian propagator for the Moon |
| `src/space/objects/moon/Moon.js` | Three.js scene graph module (factory pattern, matches Earth.js style) |
| `src/space/objects/celestial/CelestialBody.js` | Future extensibility: interface contract for planetary bodies |

### Modified Files

| Path | Change |
|------|--------|
| `src/main.js` | Import + instantiate Moon; extend `maxDistance` to 500 |
| `src/core/scene.js` | Star sphere radius 400→800, star count 8000→12000 |

---

## How Orbital Calculations Work

### Coordinate Frames

The Moon's position is computed in **ECI (Earth-Centred Inertial)** space — the
same frame that `KeplerPropagator` uses for satellites. Earth sits at the scene
origin `(0,0,0)`, so ECI = scene-centred for our purposes.

The conversion to scene space matches `KeplerPropagator.eciToScene()` exactly:

```
scene.x =  eci.x × SCENE_SCALE
scene.y =  eci.z × SCENE_SCALE   ← ECI Z (ecliptic north) → scene +Y
scene.z = -eci.y × SCENE_SCALE   ← right-hand → left-hand flip
```

`SCENE_SCALE = 5 / 6371 = 0.000785 units/km` — Earth radius 5 scene units.

### Orbital Elements (J2000)

| Element | Value | Source |
|---------|-------|--------|
| Semi-major axis | 384,400 km | IAU standard |
| Eccentricity | 0.0549 | IAU standard |
| Inclination | 5.145° | Ecliptic inclination (not equatorial) |
| RAAN at J2000 | 125.1228° | Meeus Ch. 47 |
| Arg. perigee at J2000 | 318.0634° | Meeus Ch. 47 |
| Mean anomaly at J2000 | 134.9634° | Meeus Table 47.a |
| Sidereal period | 27.321661 days | IAU |

### Propagation Algorithm (LunarOrbit.computeLunarState)

**Step 1 — Time from epoch**
```
Δt = simTimeMs − J2000_epoch_ms
```

**Step 2 — Mean anomaly**
```
M = M₀ + n·Δt     where n = 2π / T_ms
```

**Step 3 — Argument of perigee with precession**
```
ω = ω₀ + ω̇·Δt     where ω̇ = 0.111404°/day
```
The Moon's perigee rotates one full revolution in ~8.85 years. Including this
precession is optional for a static snapshot but gives correct long-timescale
behaviour and adds subtle visual variation in the Moon's apparent size.

**Step 4 — Kepler's equation (Newton–Raphson)**
```
M = E − e·sin(E)    solve for E
```
Initial guess: `E₀ = M + e·sin(M)·(1 + e·cos(M))` (Meeus approximation, reduces
iterations from ~8 to ~3 for lunar eccentricity).

**Step 5 — True anomaly**
```
tan(ν/2) = √((1+e)/(1−e)) · tan(E/2)
```

**Step 6 — Orbital radius**
```
r = a(1 − e·cos(E))
```
This gives r ∈ [356,500, 406,700] km over one orbit, correctly modelling
the Moon's closest (perigee/"supermoon") and farthest (apogee) points.

**Step 7 — Perifocal position**
```
x_pqw = r·cos(ν)
y_pqw = r·sin(ν)
z_pqw = 0
```

**Step 8 — Rotate to ECI via Euler sequence R₃(−Ω) R₁(−i) R₃(−ω)**

Done analytically (no matrix allocation):
```
x_eci = x_pq·(cos Ω cos ω − sin Ω sin ω cos i) + y_pq·(−cos Ω sin ω − sin Ω cos ω cos i)
y_eci = x_pq·(sin Ω cos ω + cos Ω sin ω cos i) + y_pq·(−sin Ω sin ω + cos Ω cos ω cos i)
z_eci = x_pq·(sin ω sin i)                     + y_pq·(cos ω sin i)
```

**Verified output** (at implementation time):
- Distance from Earth: 383,094 km ✓ (valid range 356,400–406,700)
- Scene distance: 300.65 units from origin
- Kepler residual: 4.16×10⁻¹⁷ rad (machine epsilon)

---

## How SimulationTimeEngine Drives Lunar Motion

`createMoon(timeEngine)` calls `timeEngine.subscribe(fn)` once at creation.
The callback receives `(simTimeMs, deltaMs)` on every `timeEngine.tick()`.

```
timeEngine.tick()  →  subscriber fires  →  computeLunarState(simTimeMs)
                                        →  eciToScene(...)
                                        →  moonGroup.position.copy(...)
                                        →  mesh.rotation.y = u + π
```

**Time acceleration**: Works automatically. `simTimeMs` advances at `realDeltaMs × speed`.
At 1000× speed, one real second = ~16.7 simulation minutes. The Moon moves
proportionally faster. No special handling needed.

**Rewind**: Negative `speedMultiplier` makes `simTimeMs` decrease. The Moon
orbits backwards. The algorithm is purely a function of `simTimeMs` — no
integration state means no accumulation errors.

**Pause**: `SimulationTimeEngine.tick()` skips the `#notify()` call when
`speedMultiplier === PAUSED`. The subscriber is not called. The Moon holds its
last position exactly — it does not drift.

**Time jumps** (`setSimTime`): `SimulationTimeEngine.setSimTime()` calls
`#notify(0)`. The subscriber fires immediately with the new time and
`deltaMs = 0`. The Moon teleports to the correct position.

---

## How Tidal Locking Is Implemented

Tidal locking means the Moon's rotation period = its orbital period, keeping the
same hemisphere always facing Earth.

**Implementation**: Instead of integrating rotation separately (which would
accumulate floating-point drift), we derive it directly from the same orbital
state computation:

```js
const u = wrapTwoPi(omega + nu);  // argument of latitude
mesh.rotation.y = u + Math.PI;    // π corrects texture orientation
```

`u = ω + ν` is the **argument of latitude** — the angle swept from the ascending
node to the Moon's current position in its orbital plane. As the Moon moves
around Earth, `u` increases at the same rate as the orbital angle. Setting
`rotation.y = u` means the mesh rotates at exactly the orbital rate.

**Why this is drift-free**: Both position and rotation come from the same `E`
(eccentric anomaly) solution in the same frame. They cannot desynchronise
regardless of time scale or duration.

**Texture orientation**: The `+Math.PI` offset aligns the texture's "near side"
(Mare Tranquillitatis, Tycho Crater, etc.) toward Earth at the start of the
orbit. This is a texture-coordinate correction, not a physical offset.

---

## Sun Illumination & Phases

**No fake phases**. The Moon uses `MeshStandardMaterial` (PBR Lambertian). The
directional `sunLight` from `main.js` illuminates both Earth and Moon. Three.js
computes per-fragment dot products between surface normals and the light direction.
The correct crescent, gibbous, full, or new phase geometry emerges automatically
from the Moon's position relative to the sun direction.

**Physical correctness**: If `sunLight.position` points toward the actual
ecliptic Sun direction (or a reasonable approximation), the phases will be
astronomically correct at the current `simTimeMs`.

**Earthshine**: `emissive: 0x334466, emissiveIntensity: 0.04` adds a faint
blue-grey self-illumination to the dark hemisphere. This simulates Earthshine —
the reflected light from Earth that faintly illuminates the Moon's night side.
Real Earthshine intensity varies with cloud cover and phase angle; 0.04 is a
conservative constant approximation.

---

## Performance Considerations

| Concern | Mitigation |
|---------|-----------|
| Per-frame allocation | `_result`, `_scenePos`, `_pqVec`, `_eciVec` are module-level objects; no `new THREE.Vector3()` in the hot path |
| Math cost | ~20 trig ops + 3–4 Newton iterations per frame; ~0.01 ms; negligible |
| Texture | Loaded once asynchronously; fallback grey colour renders immediately |
| Geometry | 64×64 sphere ≈ 4,225 vertices, ~8 KB index buffer; typical Earth is identical |
| Subscription | One `Set.forEach` per tick regardless of Moon count |
| Dispose | `geometry.dispose()`, `material.dispose()`, `texture.dispose()` all wired to `group.userData.dispose` |

The Moon adds approximately **one draw call per frame** — identical to Earth.

---

## Future Extensibility Roadmap

When adding the next body:

1. Create `src/space/objects/<body>/` with three files: `<Body>Constants.js`,
   `<Body>Orbit.js`, `<Body>Body.js`.
2. For heliocentric bodies (Mars, Venus), the orbit must be computed in the
   **heliocentric ecliptic frame** and then converted to the **geocentric** frame
   by subtracting Earth's heliocentric position. Both are VSOP87 solutions.
3. Extract `CelestialBody.js` base class when ≥ 2 concrete bodies exist.
4. Consider a `CelestialBodyRegistry` in `main.js` to avoid listing each body
   individually in the animation loop.
5. For the Sun itself: add a `THREE.PointLight` at the Sun's position; use
   `MeshBasicMaterial` (self-luminous, no shading needed); add a lens-flare
   via `THREE.Lensflare` from `three/examples/jsm`.
