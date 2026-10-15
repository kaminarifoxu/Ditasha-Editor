export const transformKeys = ['x', 'y', 'z', 'rx', 'ry', 'rz', 'sx', 'sy', 'sz'];
export function snapshotObject(o) {
  return {
    x: o.position.x,
    y: o.position.y,
    z: o.position.z,
    rx: (o.rotation.x * 180) / Math.PI,
    ry: (o.rotation.y * 180) / Math.PI,
    rz: (o.rotation.z * 180) / Math.PI,
    sx: o.scale.x,
    sy: o.scale.y,
    sz: o.scale.z,
    visible: o.visible,
  };
}
export function validTransform(t) {
  return (
    t &&
    transformKeys.every((k) => Number.isFinite(t[k]) && Math.abs(t[k]) <= 10000) &&
    ['sx', 'sy', 'sz'].every((k) => t[k] >= 0.001 && t[k] <= 100) &&
    typeof t.visible === 'boolean'
  );
}
export function writeObject(o, t) {
  if (!validTransform(t))
    throw Error('Transform scene tidak valid. Posisi ±10000; skala 0,001–100.');
  o.position.set(t.x, t.y, t.z);
  o.rotation.set((t.rx * Math.PI) / 180, (t.ry * Math.PI) / 180, (t.rz * Math.PI) / 180);
  o.scale.set(t.sx, t.sy, t.sz);
  o.visible = t.visible;
  o.updateMatrixWorld(true);
}
export function validateSceneProject(p, signature, keys) {
  if (
    !p ||
    p.format !== 'ditasha-scene' ||
    p.version !== 1 ||
    p.source !== signature ||
    !Array.isArray(p.objects) ||
    p.objects.length > 4096 ||
    p.objects.length !== keys.size ||
    new Set(p.objects.map((e) => e.key)).size !== keys.size ||
    p.objects.some((e) => !keys.has(e.key) || !validTransform(e.transform)) ||
    !Array.isArray(p.props) ||
    p.props.length > 8 ||
    p.props.some(
      (e) =>
        typeof e.name !== 'string' ||
        e.name.length > 150 ||
        typeof e.image !== 'string' ||
        !e.image.startsWith('data:image/png;base64,') ||
        !validTransform(e.transform),
    ) ||
    !p.camera ||
    ![p.camera.position, p.camera.target].every(
      (a) =>
        Array.isArray(a) &&
        a.length === 3 &&
        a.every((v) => Number.isFinite(v) && Math.abs(v) <= 100000),
    ) ||
    !Number.isFinite(p.camera.fov) ||
    p.camera.fov < 15 ||
    p.camera.fov > 100 ||
    !p.lighting ||
    !['neutral', 'warm', 'cool'].includes(p.lighting.preset) ||
    !Number.isFinite(p.lighting.intensity) ||
    p.lighting.intensity < 0.1 ||
    p.lighting.intensity > 3 ||
    (p.background !== null && !/^#[0-9a-f]{6}$/i.test(p.background))
  )
    throw Error(
      'Proyek scene tidak cocok atau datanya tidak valid. Buka model, drawable/LOD, dan extra yang sama.',
    );
  return p;
}
