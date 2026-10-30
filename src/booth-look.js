// Preview-only reversible surface override; does not change texture alpha/pixels.
export function applyBoothMatte(root, enabled) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m.userData.boothOriginalLook)
        m.userData.boothOriginalLook = {
          roughness: m.roughness,
          metalness: m.metalness,
          envMapIntensity: m.envMapIntensity,
          clearcoat: m.clearcoat,
          sheen: m.sheen,
          specular: m.specular?.clone(),
        };
      const original = m.userData.boothOriginalLook;
      for (const [key, value] of Object.entries(original))
        if (key !== 'specular' && value !== undefined)
          m[key] = enabled
            ? { roughness: 1, metalness: 0, envMapIntensity: 0, clearcoat: 0, sheen: 0 }[key]
            : value;
      if (m.specular && original.specular)
        enabled ? m.specular.setScalar(0) : m.specular.copy(original.specular);
      m.needsUpdate = true;
    }
  });
}
