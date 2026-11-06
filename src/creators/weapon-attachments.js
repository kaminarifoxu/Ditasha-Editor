import * as THREE from 'three';

// Authoring guides only. A GTA weapon skeleton or attachment binding cannot
// be inferred safely from a visual GLB, so guides never claim native validity.
export const WEAPON_ATTACHMENT_TYPES = Object.freeze(['grip', 'muzzle', 'magazine', 'slide', 'optic', 'flashlight', 'suppressor']);
export const WEAPON_PROJECT_SCHEMA = 1;
const SAFE_NAME = /^[A-Za-z0-9_ .-]{1,64}$/;
const finiteVector = (values, limit = 1000) => Array.isArray(values) && values.length === 3 &&
  values.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= limit);
const cleanName = name => String(name || '').replace(/\s+/g, ' ').trim();

export function inspectWeaponHierarchy(root) {
  if (!root?.isObject3D) throw new TypeError('Expected Three.js model hierarchy');
  const bones = [], candidates = [], seen = new Map(), issues = [];
  root.updateWorldMatrix(true, true);
  root.traverse(node => {
    if (node !== root && !node.isBone && !node.isMesh && !node.isGroup) return;
    if (node === root) return;
    const name = cleanName(node.name);
    if (!name) return;
    if (seen.has(name.toLowerCase())) {
      issues.push({ code: 'duplicate-node', message: 'Repeated node name: ' + name });
    } else seen.set(name.toLowerCase(), node);
    const kind = node.isBone ? 'bone' : node.isMesh ? 'mesh' : 'group';
    const position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
    node.matrixWorld.decompose(position, rotation, scale);
    if (![...position.toArray(), ...rotation.toArray(), ...scale.toArray()].every(Number.isFinite)) {
      issues.push({ code: 'invalid-node-transform', message: 'Invalid node transform: ' + name });
      return;
    }
    if (Math.max(...scale.toArray()) - Math.min(...scale.toArray()) > 0.001) {
      issues.push({ code: 'nonuniform-scale', message: name + ' has non-uniform world scale.' });
    }
    const record = { name, kind, position: position.toArray(), parent: node.parent?.name || null };
    if (node.isBone) bones.push(record);
    if (/muzzle|barrel|flash|grip|mag|clip|slide|bolt|optic|scope|sight|light|silenc|suppress|attach/i.test(name)) {
      candidates.push(record);
    }
  });
  if (!bones.length) issues.push({ code: 'missing-skeleton', message: 'No Blender/GLB bone hierarchy is available; weapon rig is not verified.' });
  if (!candidates.length) issues.push({ code: 'missing-attachments', message: 'No named attachment nodes were detected. Create manual guides for preview.' });
  return { bones, candidates, issues, hasSkeleton: bones.length > 0, nativeBoneIdsVerified: false };
}

export function validateWeaponProject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      value.schemaVersion !== WEAPON_PROJECT_SCHEMA) throw Error('Unsupported weapon project schema');
  if (!SAFE_NAME.test(value.name || '')) throw Error('Invalid weapon project name');
  if (typeof value.reference !== 'string' || !/^WEAPON_[A-Z0-9_]{3,64}$/.test(value.reference)) {
    throw Error('Invalid weapon reference');
  }
  if (!Array.isArray(value.guides) || value.guides.length > 32) throw Error('Too many weapon guides');
  const ids = new Set();
  const guides = value.guides.map(g => {
    if (!g || !WEAPON_ATTACHMENT_TYPES.includes(g.type) || !SAFE_NAME.test(g.name || '') ||
        !finiteVector(g.position) || !finiteVector(g.rotation, 360)) throw Error('Invalid weapon guide');
    if (typeof g.id !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(g.id) || ids.has(g.id)) {
      throw Error('Duplicate or invalid weapon guide ID');
    }
    ids.add(g.id);
    return { id: g.id, type: g.type, name: cleanName(g.name),
      position: [...g.position], rotation: [...g.rotation] };
  });
  // Do not trust serialized paths, shell commands, native filenames, or imports.
  if (Object.keys(value).some(k => !['schemaVersion','name','reference','guides','notes'].includes(k))) {
    throw Error('Unknown weapon project field');
  }
  if (value.notes !== undefined && (typeof value.notes !== 'string' || value.notes.length > 1000)) {
    throw Error('Invalid project notes');
  }
  return { schemaVersion: WEAPON_PROJECT_SCHEMA, name: cleanName(value.name),
    reference: value.reference, guides, notes: value.notes || '' };
}

export function createWeaponGuide(type, position = [0, 0, 0]) {
  if (!WEAPON_ATTACHMENT_TYPES.includes(type) || !finiteVector(position)) {
    throw Error('Invalid weapon guide type or position');
  }
  const id = type + '_' + Math.random().toString(36).slice(2, 10);
  return { id, type, name: type, position: [...position], rotation: [0, 0, 0] };
}

export function weaponGuideHelper(guide) {
  // All decorations are own objects; never attach guides to source geometry.
  const hue = WEAPON_ATTACHMENT_TYPES.indexOf(guide.type) / WEAPON_ATTACHMENT_TYPES.length;
  const color = new THREE.Color().setHSL(hue, 0.7, 0.6);
  const group = new THREE.Group();
  group.name = 'Guide: ' + guide.type;
  const axes = new THREE.AxesHelper(0.055);
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.009, 8, 6),
    new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.9 }),
  );
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.025, 0.0018, 4, 24),
    new THREE.MeshBasicMaterial({ color, depthTest: false }),
  );
  group.add(axes, sphere, ring);
  group.position.fromArray(guide.position);
  group.rotation.set(...guide.rotation.map(v => THREE.MathUtils.degToRad(v)));
  group.userData.weaponAuthoringGuide = true;
  return group;
}

export function disposeWeaponGuideHelper(object) {
  object.traverse(node => {
    node.geometry?.dispose();
    if (Array.isArray(node.material)) node.material.forEach(material => material.dispose());
    else node.material?.dispose();
  });
}
