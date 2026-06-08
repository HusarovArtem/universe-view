/**
 * CelestialLabelSystem.js
 * Screen-space HTML labels for celestial bodies (Earth, Moon, etc.).
 *
 * offsetY is in PIXELS (positive = up from the projected center point).
 * The body's radius is used only to push the label above the sphere's
 * projected top edge; it is converted to screen pixels via perspective math.
 */

import * as THREE from 'three';

const _worldPos = new THREE.Vector3();
const _worldTop = new THREE.Vector3();

const LABEL_FADE_NEAR = 4;

export class CelestialLabelSystem {
    #container;
    #camera;
    #renderer;
    #labels = new Map();
    #visible = true;

    constructor(camera, renderer) {
        this.#camera   = camera;
        this.#renderer = renderer;

        this.#container = document.createElement('div');
        this.#container.id = 'celestial-labels';
        Object.assign(this.#container.style, {
            position:      'fixed',
            inset:         '0',
            pointerEvents: 'none',
            zIndex:        '50',
        });
        document.body.appendChild(this.#container);
    }

    /**
     * @param {{ id, group, title, subtitle, radius }} config
     *   radius — the body's scene-space radius (used to push label above sphere top)
     */
    register(config) {
        const el = this.#createElement(config);
        this.#container.appendChild(el);
        this.#labels.set(config.id, { config, el });
    }

    unregister(id) {
        const entry = this.#labels.get(id);
        if (entry) {
            this.#container.removeChild(entry.el);
            this.#labels.delete(id);
        }
    }

    setSubtitle(id, subtitle) {
        const entry = this.#labels.get(id);
        if (!entry) return;
        const sub = entry.el.querySelector('.cel-label-sub');
        if (sub) sub.textContent = subtitle;
    }

    setAllVisible(visible) {
        this.#visible = visible;
        this.#container.style.display = visible ? '' : 'none';
    }

    setVisible(id, visible) {
        const entry = this.#labels.get(id);
        if (!entry) return;
        entry.el.style.display = visible ? '' : 'none';
    }

    update() {
        if (!this.#visible) return;

        const canvas = this.#renderer.domElement;
        const W = canvas.clientWidth;
        const H = canvas.clientHeight;

        for (const { config, el } of this.#labels.values()) {
            if (el.style.display === 'none') continue;

            // Get body center in world space
            config.group.getWorldPosition(_worldPos);

            // Project center to NDC
            const ndcCenter = _worldPos.clone().project(this.#camera);

            // Discard if behind camera
            if (ndcCenter.z > 1) {
                el.style.opacity = '0';
                continue;
            }

            // Project a point one radius above the body (in view-up direction)
            // to find where the top of the sphere sits in screen space.
            // This correctly handles perspective foreshortening at any zoom.
            const radius = config.radius ?? 1;

            // View-space "up" in world coords
            const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.#camera.quaternion);
            _worldTop.copy(_worldPos).addScaledVector(camUp, radius);
            const ndcTop = _worldTop.clone().project(this.#camera);

            // Screen pixel positions
            const cx = (ndcCenter.x *  0.5 + 0.5) * W;
            const cy = (-ndcCenter.y * 0.5 + 0.5) * H;
            const ty = (-ndcTop.y    * 0.5 + 0.5) * H;

            // Pixel offset: place label above the sphere top + 12px gap
            const sphereTopPixelY = ty;
            const labelY = sphereTopPixelY - 12;

            el.style.left      = `${cx}px`;
            el.style.top       = `${labelY}px`;
            el.style.transform = 'translate(-50%, -100%)';

            // Fade when very close
            const dist = this.#camera.position.distanceTo(_worldPos);
            const fade = dist < LABEL_FADE_NEAR
                ? Math.max(0, (dist - 2) / (LABEL_FADE_NEAR - 2))
                : 1;
            el.style.opacity = String(fade);
        }
    }

    #createElement(config) {
        const wrapper = document.createElement('div');
        wrapper.className  = 'cel-label';
        wrapper.dataset.id = config.id;
        Object.assign(wrapper.style, {
            position:   'absolute',
            opacity:    '0',
            transition: 'opacity 0.4s ease',
        });

        const title = document.createElement('div');
        title.className   = 'cel-label-title';
        title.textContent = config.title;
        wrapper.appendChild(title);

        if (config.subtitle) {
            const sub = document.createElement('div');
            sub.className   = 'cel-label-sub';
            sub.textContent = config.subtitle;
            wrapper.appendChild(sub);
        }

        return wrapper;
    }

    dispose() {
        document.body.removeChild(this.#container);
        this.#labels.clear();
    }
}
