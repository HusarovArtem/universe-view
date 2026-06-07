# Universe View — Frontend

## Architecture

```
src/
├── core/           # Pure Three.js setup (scene, camera, renderer)
├── earth/          # Earth-specific modules
│   ├── Earth.js        — surface mesh + atmosphere
│   ├── cities.js       — capital markers (add/highlight/reset)
│   ├── countryBorders.js — GeoJSON → LineSegments
├── objects/        # 🚀 Future: Sun, Moon, planets, satellites
│   └── (empty — add CelestialBody.js here in Stage 3)
├── ui/             # DOM / interaction systems
│   ├── HoverSystem.js  — raycasting manager
│   └── InfoPanel.js    — DOM panel controller
├── utils/
│   └── latlon.js       — coordinate conversion math
├── data/
│   ├── capitals.json
│   └── countries.geojson
├── main.js         # Orchestration only — no logic
└── style.css
```

## How to add a new solar system object (Stage 3)

1. Create `src/objects/Moon.js` (or `Planet.js`, `Satellite.js`)
2. Export a `createMoon()` function that returns a `THREE.Group`
3. Add `group.name = 'Moon'` for easy lookup
4. Import and add to scene in `main.js`

Pattern:
```js
// objects/Moon.js
export function createMoon(earthGroup) {
    const group = new THREE.Group();
    group.name = 'Moon';
    // ... geometry, material, orbit logic
    return group;
}
```

## Running

```bash
npm install
npm run dev
```

## Stages

| Stage | Status | Description |
|-------|--------|-------------|
| 0     | ✅     | Globe, zoom, rotate, lat/lon markers |
| 1     | ✅     | Real texture, borders, atmosphere, capitals |
| 2     | ⏳     | TLE satellites, REST API connection |
| 3     | ⏳     | Full solar system, AI endpoint |