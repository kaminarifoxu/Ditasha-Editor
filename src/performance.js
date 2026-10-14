export const qualityProfiles = {
  eco: { label: 'Hemat', ratio: 1, fps: 30, pixels: 1500000 },
  balanced: { label: 'Seimbang', ratio: 1.5, fps: 60, pixels: 3000000 },
  high: { label: 'Detail', ratio: 2, fps: 60, pixels: 6000000 },
};
export function previewRatio(profile, width, height, deviceRatio = 1) {
  const p = Object.hasOwn(qualityProfiles, profile)
    ? qualityProfiles[profile]
    : qualityProfiles.balanced;
  return Math.max(
    0.25,
    Math.min(deviceRatio, p.ratio, Math.sqrt(p.pixels / Math.max(1, width * height))),
  );
}
let profile = 'balanced';
try {
  if (Object.hasOwn(qualityProfiles, localStorage.getItem('ditasha.previewQuality')))
    profile = localStorage.getItem('ditasha.previewQuality');
} catch {}
const previews = new Set();
export function managePreview({ renderer, camera, scene, controls, container, toast }) {
  let dirty = true,
    lost = false,
    previous = 0,
    scheduled = false;
  const invalidate = () => {
    dirty = true;
    if (!scheduled) {
      scheduled = true;
      setTimeout(() => {
        scheduled = false;
        if (dirty && !lost && !container.closest('[hidden]')) {
          dirty = false;
          renderer.render(scene, camera);
        }
      }, 20);
    }
  };
  controls.addEventListener('change', invalidate);
  for (const type of ['click', 'input', 'change']) document.addEventListener(type, invalidate);
  const resize = () => {
    const w = container.clientWidth,
      h = container.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(previewRatio(profile, w, h, window.devicePixelRatio || 1));
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dirty = true;
    if (!lost) renderer.render(scene, camera);
  };
  new ResizeObserver(resize).observe(container);
  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
    toast('GPU kehilangan konteks. Data edit tetap disimpan di memori; menunggu GPU pulih.');
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    lost = false;
    dirty = true;
    resize();
    toast('Preview GPU berhasil dipulihkan.');
  });
  renderer.setAnimationLoop((time) => {
    if (
      lost ||
      document.hidden ||
      container.closest('[hidden]') ||
      time - previous < 1000 / qualityProfiles[profile].fps
    )
      return;
    previous = time;
    controls.update();
    if (dirty) {
      dirty = false;
      renderer.render(scene, camera);
    }
  });
  const entry = { renderer, resize, container };
  previews.add(entry);
  resize();
  return { invalidate, resize };
}
export function mountPerformance() {
  const button = document.createElement('button');
  button.id = 'previewPerformance';
  button.title = 'GPU dan kualitas preview';
  const dialog = document.createElement('dialog');
  dialog.className = 'studio-dialog performance-dialog';
  dialog.id = 'performanceDialog';
  dialog.innerHTML = `<div class="studio-dialog-head"><div><span class="eyebrow">RENDERING</span><h2>GPU & performa</h2></div><button type="button" data-close aria-label="Tutup">×</button></div><label>Kualitas preview<select id="previewQuality"><option value="eco">Hemat · 30 FPS · resolusi rendah</option><option value="balanced">Seimbang · 60 FPS</option><option value="high">Detail · 60 FPS · resolusi tinggi</option></select></label><p class="muted">Preview menggunakan WebGL pada GPU yang dipilih sistem. Untuk laptop dengan dua GPU, pilih DITASHA-Editor pada pengaturan Graphics Windows. Mode Hemat mengurangi resolusi preview, bukan kualitas tekstur atau ekspor.</p><div id="gpuDiagnostics" role="status"></div>`;
  document.body.append(dialog);
  document.querySelector('header').insertBefore(button, document.getElementById('openUpdates'));
  const select = dialog.querySelector('select');
  select.value = profile;
  const refresh = () => {
    button.textContent = 'GPU · ' + qualityProfiles[profile].label;
    const root = dialog.querySelector('#gpuDiagnostics');
    root.replaceChildren();
    for (const { renderer, container } of previews) {
      const p = document.createElement('p'),
        gl = renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      p.textContent = `${container.id}: ${gpu} · ${renderer.domElement.width} × ${renderer.domElement.height} · ${renderer.info.memory.geometries} geometri · ${renderer.info.memory.textures} tekstur · ${renderer.info.render.triangles.toLocaleString()} triangle/frame`;
      root.append(p);
    }
  };
  select.onchange = () => {
    profile = select.value;
    try {
      localStorage.setItem('ditasha.previewQuality', profile);
    } catch {}
    previews.forEach((p) => p.resize());
    refresh();
  };
  button.onclick = () => {
    refresh();
    dialog.showModal();
  };
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  refresh();
}
