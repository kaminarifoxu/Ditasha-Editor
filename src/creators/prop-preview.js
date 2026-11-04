import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';

const VALID_COLLISION = new Set(['none', 'box', 'convex', 'authored']);
export function validatePreviewSettings(value) {
  const settings = { collision: 'box', pivot: [0, 0, 0], drawDistance: 120, lodDistances: [30, 70], ...value };
  if (!VALID_COLLISION.has(settings.collision)) throw Error('Invalid collision preview mode');
  if (!Array.isArray(settings.pivot) || settings.pivot.length !== 3 ||
      settings.pivot.some(n => !Number.isFinite(n) || Math.abs(n) > 10000)) throw Error('Invalid pivot');
  if (!Number.isFinite(settings.drawDistance) || settings.drawDistance < 1 || settings.drawDistance > 2000) throw Error('Invalid draw distance');
  if (!Array.isArray(settings.lodDistances) || settings.lodDistances.length > 4 ||
      settings.lodDistances.some(n => !Number.isFinite(n) || n < 1 || n > settings.drawDistance) ||
      settings.lodDistances.some((n, i) => i > 0 && n <= settings.lodDistances[i - 1])) throw Error('Invalid LOD ranges');
  return { collision: settings.collision, pivot: [...settings.pivot], drawDistance: settings.drawDistance, lodDistances: [...settings.lodDistances] };
}
function finiteBounds(box) {
  if (box.isEmpty()) return false;
  return [...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite);
}
export function makePropPreviewOverlay(model, options = {}) {
  if (!model?.isObject3D) throw Error('Expected existing Three.js model');
  const settings = validatePreviewSettings(options);
  const overlay = new THREE.Group();
  overlay.name = 'DITASHA prop inspection overlay (preview only)';
  overlay.userData.ditashaPreviewOnly = true;
  const bounds = new THREE.Box3().setFromObject(model);
  if (!finiteBounds(bounds)) throw Error('Empty or invalid prop bounds');
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  overlay.add(new THREE.Box3Helper(bounds, 0xd5b444));
  const pivot = new THREE.AxesHelper(Math.max(size.length() * 0.15, 0.15));
  pivot.position.set(...settings.pivot);
  overlay.add(pivot);
  if (settings.collision !== 'none' && settings.collision !== 'authored') {
    let shape = null;
    if (settings.collision === 'box') {
      shape = new THREE.BoxGeometry(Math.max(size.x, 0.001), Math.max(size.y, 0.001), Math.max(size.z, 0.001));
    } else {
      // Build a world-aligned convex preview; do not serialize this as YBN.
      const points = [];
      const vector = new THREE.Vector3();
      model.updateWorldMatrix(true, true);
      model.traverse(object => {
        if (!object.isMesh || !object.geometry?.attributes?.position) return;
        const position = object.geometry.attributes.position;
        object.updateWorldMatrix(true, false);
        const transform = object.matrixWorld;
        const stride = Math.max(1, Math.ceil(position.count / 256));
        for (let i = 0; i < position.count && points.length < 1024; i += stride) {
          vector.fromBufferAttribute(position, i).applyMatrix4(transform).sub(center);
          if ([vector.x, vector.y, vector.z].every(Number.isFinite)) points.push(vector.clone());
        }
      });
      try { if (points.length >= 4) shape = new ConvexGeometry(points); } catch { shape = null; }
      if (!shape) shape = new THREE.BoxGeometry(Math.max(size.x, 0.001), Math.max(size.y, 0.001), Math.max(size.z, 0.001));
    }
    const collision = new THREE.Mesh(shape, new THREE.MeshBasicMaterial({ color: 0x46a8ff, wireframe: true, depthTest: false, transparent: true, opacity: 0.65 }));
    collision.name = 'Collision preview (not native YBN)';
    // Bounds are world-space. Overlay is added at scene root, not inside model.
    collision.position.copy(center);
    overlay.add(collision);
  }
  // View guides display LOD thresholds only, not actual converted LOD geometry.
  for (const [index, radius] of settings.lodDistances.entries()) {
    const pts = [];
    for (let step = 0; step < 65; step++) {
      const a = step / 64 * Math.PI * 2;
      pts.push(new THREE.Vector3(center.x + Math.cos(a) * radius, bounds.min.y, center.z + Math.sin(a) * radius));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(pts);
    const guide = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: index % 2 ? 0x7ccacf : 0xe1bb5a, transparent: true, opacity: 0.6 }));
    guide.name = 'LOD threshold ' + radius;
    overlay.add(guide);
  }
  return {
    group: overlay,
    bounds: bounds.clone(),
    settings,
    dispose() {
      overlay.parent?.remove(overlay);
      overlay.traverse(o => {
        o.geometry?.dispose();
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material?.dispose();
      });
    },
  };
}
export function mountPropPreview({ container, getModel, scene, render, nativeAvailable = false }) {
  if (!container || !scene?.isScene || typeof getModel !== 'function') throw Error('Invalid prop preview mount');
  const panel = document.createElement('details');
  panel.className = 'workshop-fold prop-preview-inspector';
  panel.innerHTML = '<summary>Prop & Collision Preview (experimental)</summary><label>Collision guide<select data-prop-collision><option value="none">None</option><option value="box" selected>Box</option><option value="convex">Convex preview</option><option value="authored">Authored (not simulated)</option></select></label><label>Pivot X<input data-prop-pivot="0" type="number" min="-10000" max="10000" step=".01" value="0"></label><label>Pivot Y<input data-prop-pivot="1" type="number" min="-10000" max="10000" step=".01" value="0"></label><label>Pivot Z<input data-prop-pivot="2" type="number" min="-10000" max="10000" step=".01" value="0"></label><label>LOD distances (comma separated)<input data-prop-lods value="30,70"></label><button data-prop-refresh>Refresh guides</button><button data-prop-clear>Hide guides</button><p class="muted" data-prop-status role="status">Preview guides only; no native collision generated.</p>';
  container.append(panel);
  let current = null;
  const status = panel.querySelector('[data-prop-status]');
  function clear() {
    current?.dispose(); current = null;
    render?.();
  }
  function refresh() {
    clear();
    try {
      const model = getModel();
      if (!model || !model.children.length) throw Error('Load a prop model in the existing viewer first');
      const pivot = [...panel.querySelectorAll('[data-prop-pivot]')].map(el => Number(el.value));
      const lodDistances = panel.querySelector('[data-prop-lods]').value.split(',').map(s => Number(s.trim())).filter((n,i,a) => !(a.length === 1 && n === 0));
      current = makePropPreviewOverlay(model, { collision: panel.querySelector('[data-prop-collision]').value, pivot, lodDistances });
      scene.add(current.group);
      status.textContent = 'Bounds and guides generated; no GTA collision file exported.';
      render?.();
    } catch (error) { status.textContent = error.message; }
  }
  let timer = null, activeJob = null, inputGrant = null, outputGrant = null;
  if (nativeAvailable && window.ditashaCreators?.startProp) {
    const controls = document.createElement('details');
    controls.className = 'workshop-fold prop-native-build';
    controls.innerHTML = '<summary>Native FiveM prop export · experimental</summary><p class="muted">Requires managed Blender/Sollumz/PyMateria. This builds the selected file separately from the preview model. Native export is validated before saving.</p><button data-prop-source>Select GLB / OBJ / FBX</button><small data-prop-source-label>No model selected</small><button data-prop-output>Select export folder</button><small data-prop-output-label>No export folder selected</small><label>Resource name<input data-prop-name value="ditasha_prop" maxlength="48"></label><label>Draw distance<input data-prop-distance type="number" min="1" max="2000" value="120"></label><button data-prop-build>Build & validate native resource</button><button data-prop-cancel disabled>Cancel build</button><p data-prop-native-status class="muted" role="status">Idle. Native output is not certified until the installed provider and game are tested.</p>';
    panel.append(controls);
    const api = window.ditashaCreators;
    const nativeStatus = controls.querySelector('[data-prop-native-status]');
    const setStatus = message => nativeStatus.textContent = message;
    controls.querySelector('[data-prop-source]').addEventListener('click', async () => {
      try {
        const grant = await api.pickProp('input');
        if (!grant) return;
        if (inputGrant) await api.revokeProp(inputGrant.token).catch(() => {});
        inputGrant = grant;
        controls.querySelector('[data-prop-source-label]').textContent = grant.name;
      } catch (error) { setStatus(error.message); }
    });
    controls.querySelector('[data-prop-output]').addEventListener('click', async () => {
      try {
        const grant = await api.pickProp('output');
        if (!grant) return;
        if (outputGrant) await api.revokeProp(outputGrant.token).catch(() => {});
        outputGrant = grant;
        controls.querySelector('[data-prop-output-label]').textContent = grant.name;
      } catch (error) { setStatus(error.message); }
    });
    const build = controls.querySelector('[data-prop-build]');
    const cancel = controls.querySelector('[data-prop-cancel]');
    controls.querySelector('[data-prop-build]').addEventListener('click', async () => {
      if (activeJob) return;
      if (!inputGrant || !outputGrant) { setStatus('Select both the source file and export folder.'); return; }
      const distance = Number(controls.querySelector('[data-prop-distance]').value);
      const lodDistances = panel.querySelector('[data-prop-lods]').value.split(',').map(s => Number(s.trim())).filter(Number.isFinite);
      try {
        const result = await api.startProp({
          schemaVersion: 1,
          sourceToken: inputGrant.token, outputToken: outputGrant.token,
          sourceName: inputGrant.name,
          projectName: controls.querySelector('[data-prop-name]').value.trim(),
          edition: 'legacy', collision: panel.querySelector('[data-prop-collision]').value,
          drawDistance: distance, lodDistances,
        });
        activeJob = result.jobId;
        build.disabled = true;
        cancel.disabled = false;
        setStatus('Native job started. Output will only be saved after verification.');
        const poll = async () => {
          try {
            const job = await api.propJob(activeJob);
            if (!job) { setStatus('Job status unavailable.'); clearInterval(timer); timer = null; activeJob = null; build.disabled = false; cancel.disabled = true; return; }
            if (job.state === 'queued' || job.state === 'running') return;
            clearInterval(timer); timer = null; activeJob = null;
            build.disabled = false; cancel.disabled = true;
            if (job.state === 'succeeded') setStatus('Native files validated and saved: ' + job.result.output + '. In-game verification still required.');
            else setStatus('Native build ' + job.state + ': ' + (job.error || 'No further details'));
          } catch (error) { setStatus(error.message); clearInterval(timer); timer = null; activeJob = null; build.disabled = false; cancel.disabled = true; }
        };
        timer = setInterval(poll, 750);
        await poll();
      } catch (error) { setStatus(error.message); activeJob = null; build.disabled = false; cancel.disabled = true; }
    });
    cancel.addEventListener('click', async () => {
      if (activeJob) {
        try { await api.cancelProp(activeJob); setStatus('Cancelling native build…'); }
        catch (error) { setStatus(error.message); }
      }
    });
  }
  panel.querySelector('[data-prop-refresh]').addEventListener('click', refresh);
  panel.querySelector('[data-prop-clear]').addEventListener('click', clear);
  return { panel, refresh, clear, dispose() { if (timer) clearInterval(timer); clear(); panel.remove(); } };
}
