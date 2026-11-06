import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { mountPropPreview } from './prop-preview.js';

const accepted = /\.(glb|obj|fbx)$/i;
function disposeModel(object) {
  if (!object) return;
  object.traverse(node => {
    node.geometry?.dispose();
    for (const material of Array.isArray(node.material) ? node.material : node.material ? [node.material] : []) {
      for (const value of Object.values(material)) {
        if (value?.isTexture) value.dispose();
      }
      material.dispose();
    }
  });
}
export async function parsePropModel(file) {
  if (!file || !accepted.test(file.name || '')) throw Error('Choose a GLB, OBJ or FBX model');
  if (file.size <= 0 || file.size > 256 * 1024 * 1024) throw Error('Model size must be 1 byte to 256 MB');
  const ext = file.name.split('.').pop().toLowerCase();
  const data = await file.arrayBuffer();
  if (ext === 'glb') {
    const result = await new GLTFLoader().parseAsync(data, '');
    return result.scene;
  }
  if (ext === 'obj') return new OBJLoader().parse(new TextDecoder().decode(data));
  return new FBXLoader().parse(data, '');
}
export function mountPropWorkspace({ nav, activate, register, capabilities }) {
  if (!nav || typeof activate !== 'function' || typeof register !== 'function') throw Error('Prop workspace dependencies missing');
  const root = document.createElement('section');
  root.className = 'prop-creator-workspace';
  root.dataset.creatorWorkspace = 'propcreator';
  root.hidden = true;
  root.innerHTML = [
    '<header class="prop-header"><div><span class="prop-eyebrow">ASSET WORKSHOP / PHASE 3</span>',
    '<h1>Prop &amp; Collision Creator</h1><p>Model preview, collision guides, pivot and LOD inspection · GTA V Legacy</p></div>',
    '<div class="prop-header-actions"><button data-prop-open class="primary">Import 3D Model</button>',
    '<input data-prop-file type="file" accept=".glb,.obj,.fbx" hidden></div></header>',
    '<div class="prop-layout"><aside class="prop-sidebar">',
    '<h2>Model source</h2><div class="prop-source"><strong data-prop-name>No model selected</strong>',
    '<small data-prop-meta>GLB · OBJ · FBX, up to 256 MB</small></div>',
    '<button data-prop-import>Choose model</button>',
    '<h2>Inspection tools</h2><div data-prop-inspector></div>',
    '</aside><section class="prop-viewport-card">',
    '<div class="prop-viewport-toolbar"><strong>3D workspace</strong><span data-prop-model-state>Empty scene</span>',
    '<button data-prop-frame title="Frame model">Frame</button><button data-prop-reset title="Reset camera">Reset view</button></div>',
    '<div class="prop-viewport" data-prop-viewport><div class="prop-empty" data-prop-empty>',
    '<strong>Import a model to begin</strong><p>Drag-and-drop a GLB, OBJ or FBX, or use Import 3D Model.</p></div></div>',
    '<div class="prop-viewport-footer">Left mouse: orbit · Wheel: zoom · Right mouse: pan</div></section>',
    '<aside class="prop-right"><h2>Project overview</h2><div class="prop-summary">',
    '<div>Format <strong data-prop-format>—</strong></div><div>Meshes <strong data-prop-meshes>—</strong></div>',
    '<div>Size <strong data-prop-bounds>—</strong></div><div>Collision <strong>Preview only</strong></div></div>',
    '<h2>Resize prop</h2><p>Scale the preview and exported mesh/collision together.</p>',
    '<label class="prop-scale-lock"><input type="checkbox" data-prop-uniform checked> Uniform scale (lock X / Y / Z)</label>',
    '<div class="prop-scale-fields"><label>X<input data-prop-scale="0" type="number" value="1" min="0.01" max="100" step="0.05"></label>',
    '<label>Y<input data-prop-scale="1" type="number" value="1" min="0.01" max="100" step="0.05"></label>',
    '<label>Z<input data-prop-scale="2" type="number" value="1" min="0.01" max="100" step="0.05"></label></div>',
    '<button data-prop-scale-reset>Reset scale (1×)</button>',
    '<h2>FiveM export</h2><p>Export YDR / YTD / YBN / YTYP via managed Blender/Sollumz. The native exporter remains experimental.</p>',
    '<p class="prop-warning">Test the native engine first. Generated resources still require an in-game FiveM check.</p>',
    '<div data-prop-export></div></aside></div>',
    '<p class="prop-status" data-prop-message role="status">Ready to import a prop model.</p>',
  ].join('');
  nav.after(root);
  const viewport = root.querySelector('[data-prop-viewport]');
  const message = root.querySelector('[data-prop-message]');
  const empty = root.querySelector('[data-prop-empty]');
  const sourceInput = root.querySelector('[data-prop-file]');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x151b25);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 30000);
  camera.position.set(3, 2, 4);
  const grid = new THREE.GridHelper(20, 20, 0x405574, 0x273244);
  scene.add(grid, new THREE.HemisphereLight(0xffffff, 0x405578, 2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.set(6, 9, 7);
  scene.add(sun);
  let renderer = null, controls = null, model = new THREE.Group(), inspector = null, mounted = false, active = false, loading = false;
  const scale = [1, 1, 1];
  let intrinsicScale = new THREE.Vector3(1, 1, 1);
  scene.add(model);
  const notify = value => { message.textContent = value; };
  function paint() {
    if (!renderer || root.hidden) return;
    const width = Math.max(1, viewport.clientWidth), height = Math.max(1, viewport.clientHeight);
    if (renderer.domElement.width !== Math.floor(width * renderer.getPixelRatio()) ||
        renderer.domElement.height !== Math.floor(height * renderer.getPixelRatio())) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    controls?.update();
    renderer.render(scene, camera);
  }
  function frame() {
    if (!model.children.length || !controls) return;
    const bounds = new THREE.Box3().setFromObject(model);
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const radius = Math.max(size.length() * 0.7, 1);
    controls.target.copy(center);
    camera.position.copy(center).add(new THREE.Vector3(radius, radius * 0.6, radius * 1.4));
    camera.near = Math.max(0.001, radius / 10000);
    camera.far = Math.max(1000, radius * 100);
    camera.updateProjectionMatrix();
    controls.update();
    paint();
  }
  function updateBounds() {
    if (!model.children.length) return;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    root.querySelector('[data-prop-bounds]').textContent =
      size.toArray().map(value => value.toFixed(2)).join(' × ');
  }
  function applyScale() {
    model.scale.set(
      intrinsicScale.x * scale[0], intrinsicScale.y * scale[1], intrinsicScale.z * scale[2]
    );
    model.updateMatrixWorld(true);
    updateBounds();
    inspector?.refresh();
    paint();
  }
  for (const field of root.querySelectorAll('[data-prop-scale]')) {
    field.addEventListener('change', () => {
      const n = Number(field.value);
      if (!Number.isFinite(n) || n < 0.01 || n > 100) {
        field.value = scale[Number(field.dataset.propScale)];
        notify('Scale must be between 0.01 and 100 for each axis.');
        return;
      }
      const index = Number(field.dataset.propScale);
      if (root.querySelector('[data-prop-uniform]').checked) {
        for (let axis = 0; axis < 3; axis++) {
          scale[axis] = n;
          root.querySelector('[data-prop-scale="' + axis + '"]').value = String(n);
        }
      } else {
        scale[index] = n;
      }
      applyScale();
    });
  }
  root.querySelector('[data-prop-uniform]').addEventListener('change', event => {
    if (!event.target.checked) return;
    const n = scale[0];
    for (let axis = 0; axis < 3; axis++) {
      scale[axis] = n;
      root.querySelector('[data-prop-scale="' + axis + '"]').value = String(n);
    }
    applyScale();
  });
  root.querySelector('[data-prop-scale-reset]').addEventListener('click', () => {
    for (let axis = 0; axis < 3; axis++) {
      scale[axis] = 1;
      root.querySelector('[data-prop-scale="' + axis + '"]').value = '1';
    }
    applyScale();
  });
  function init() {
    if (mounted) return;
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = 'prop-canvas';
    viewport.prepend(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    mounted = true;

  }
  function clearGuides() { inspector?.clear(); }
  async function importFile(file) {
    if (loading) return;
    loading = true;
    notify('Loading ' + (file?.name || 'model') + '…');
    try {
      const next = await parsePropModel(file);
      clearGuides();
      scene.remove(model);
      disposeModel(model);
      model = next;
      intrinsicScale = model.scale.clone();
      applyScale();
      scene.add(model);
      empty.hidden = true;
      root.querySelector('[data-prop-name]').textContent = file.name;
      root.querySelector('[data-prop-format]').textContent = file.name.split('.').pop().toUpperCase();
      const meshes = [];
      model.traverse(node => { if (node.isMesh) meshes.push(node); });
      root.querySelector('[data-prop-meshes]').textContent = String(meshes.length);
      updateBounds();
      root.querySelector('[data-prop-meta]').textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB · ' + meshes.length + ' meshes';
      root.querySelector('[data-prop-model-state]').textContent = file.name;
      frame();
      notify('Model loaded. Adjust collision, pivot and LOD guides in the left panel.');
    } catch (error) {
      notify('Model import failed: ' + error.message);
    } finally { loading = false; }
  }
  sourceInput.addEventListener('change', () => {
    const file = sourceInput.files?.[0];
    if (file) void importFile(file);
    sourceInput.value = '';
  });
  for (const selector of ['[data-prop-open]', '[data-prop-import]']) {
    root.querySelector(selector).addEventListener('click', () => sourceInput.click());
  }
  root.querySelector('[data-prop-frame]').addEventListener('click', frame);
  root.querySelector('[data-prop-reset]').addEventListener('click', () => {
    if (!controls) return;
    camera.position.set(3, 2, 4);
    controls.target.set(0, 0, 0);
    controls.update();
    paint();
  });
  for (const event of ['dragenter', 'dragover']) viewport.addEventListener(event, e => { e.preventDefault(); });
  viewport.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) void importFile(file);
  });
  const resizer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(paint) : null;
  resizer?.observe(viewport);
  async function onEnter() {
    active = true;
    try { init(); } catch (error) { notify('WebGL unavailable: ' + error.message); return; }
    if (!inspector) {
      let nativeAvailable = false;
      try { nativeAvailable = await capabilities?.getNativeAvailability?.() === true; }
      catch { nativeAvailable = false; }
      if (!active || inspector) return;
      inspector = mountPropPreview({
        container: root.querySelector('[data-prop-inspector]'),
        getModel: () => model,
        scene,
        nativeAvailable,
        getScale: () => [...scale],
        render: paint,
      });
      inspector.panel.open = true;
      const nativePanel = inspector.panel.querySelector('.prop-native-build');
      if (nativePanel) {
        root.querySelector('[data-prop-export]').append(nativePanel);
        nativePanel.open = true; // Export to FiveM is visible in normal launches.
      }
    }
    renderer.setAnimationLoop(() => paint());
    paint();
  }
  function onLeave() {
    active = false;
    renderer?.setAnimationLoop(null);
  }
  register('propcreator', { root, onEnter, onLeave });
  return { root, onEnter, onLeave, importFile, frame };
}
