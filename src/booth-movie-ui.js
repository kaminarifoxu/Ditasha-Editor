import { MOVIE_DEFAULTS, setMovieKey, sampleMovie, validateMovie } from './booth-movie.js';
const clone = (v) => JSON.parse(JSON.stringify(v));
export function mountBoothMovie({
  root,
  getFrame,
  applyFrame,
  sample,
  layout,
  notify,
  exportVideo,
}) {
  const panel = document.createElement('section');
  panel.id = 'pbMoviePanel';
  panel.className = 'pb-movie-panel';
  panel.hidden = true;
  panel.innerHTML = `<header><strong>Video · kamera & keyframe</strong><button id="pbMovieMinimize" aria-expanded="true">Minimalkan</button><button id="pbMovieClose" aria-label="Tutup video">×</button></header><div id="pbMovieBody"><p class="muted">1. Atur kamera dengan drag/scroll. 2. Pilih waktu. 3. Tambah titik kamera. 4. Preview atau ekspor.</p><div class="pb-movie-fields"><label>Durasi · detik<input id="pbMovieDuration" type="number" min="1" max="120" step="1" value="10"></label><label>FPS<select id="pbMovieFps"><option>24</option><option>30</option></select></label><label>Video<select id="pbMovieSize"><option value="1280x720">720p landscape</option><option value="1920x1080">1080p landscape</option><option value="1080x1920">1080p portrait</option><option value="1080x1080">1080 × 1080</option></select></label><label>Transisi<select id="pbMovieBlend"><option value="smooth">Halus · ease in/out</option><option value="linear">Linear</option><option value="cut">Cut</option></select></label></div><label>Playhead · detik<input id="pbMovieTime" type="number" min="0" max="10" step="0.01" value="0"></label><input id="pbMovieScrub" aria-label="Timeline kamera" type="range" min="0" max="10" step="0.01" value="0"><div id="pbMovieMarkers" class="pb-movie-markers" aria-label="Titik kamera"></div><div class="pb-buttons"><button id="pbMovieKey">＋ Tambah/perbarui titik</button><button id="pbMovieDelete">Hapus titik</button><button id="pbMoviePlay">▶ Preview</button><button id="pbMovieStop">Jeda</button></div><p id="pbMovieKeyStatus" class="muted">Belum ada titik kamera.</p><details open><summary>Kamera & lensa</summary><div class="pb-movie-fields"><label>FOV / zoom · derajat<input data-movie="fov" type="number" min="10" max="175" step="1" value="35"></label><label>Roll / kemiringan · derajat<input data-movie="roll" type="number" min="-180" max="180" step="1" value="0"></label></div><label class="check"><input data-movie="fisheye" type="checkbox">Fisheye circular · equidistant</label><p class="muted">Fisheye memakai cubemap 512 px per sisi; lebih berat. Naikkan FOV untuk sudut lebar. Lensa dan cahaya ikut disimpan pada setiap titik.</p></details><details><summary>Cahaya & bayangan detail</summary><div class="pb-movie-fields">${[
    ['power', 'Cahaya utama', 0.3, 3, 0.1],
    ['fill', 'Fill light', 0, 4, 0.1],
    ['ambient', 'Ambient', 0, 4, 0.1],
    ['height', 'Tinggi cahaya · m', 0.1, 30, 0.1],
    ['distance', 'Jarak cahaya · m', 0.1, 30, 0.1],
    ['shadowAngle', 'Arah cahaya · derajat', 0, 360, 1],
    ['shadowStrength', 'Kekuatan bayangan', 0, 1, 0.05],
    ['shadowBias', 'Shadow bias', -0.02, 0.02, 0.0001],
    ['normalBias', 'Normal bias', 0, 0.2, 0.005],
    ['shadowRadius', 'Radius filter · mode PCF', 0, 5, 0.1],
  ]
    .map(
      ([key, label, min, max, step]) =>
        `<label>${label}<input data-movie="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${MOVIE_DEFAULTS[key]}"></label>`,
    )
    .join(
      '',
    )}<label>Warna key<input data-movie="keyColor" type="color" value="#fff1df"></label><label>Warna fill<input data-movie="fillColor" type="color" value="#cbdcff"></label><label>Resolusi bayangan<select data-movie="shadowSize"><option>512</option><option selected>1024</option><option>2048</option></select></label><label>Filter bayangan<select data-movie="shadowMode"><option value="soft">Soft PCF</option><option value="pcf">PCF · radius</option><option value="hard">Hard</option></select></label></div><label class="check"><input data-movie="shadows" type="checkbox" checked>Aktifkan bayangan</label></details><label class="check"><input id="pbMovieAnimate" type="checkbox" checked>Animasikan emote tiap ped</label><div class="pb-buttons"><button id="pbMovieExport" class="primary">Ekspor WebM</button><button id="pbMovieCancel" disabled>Batalkan ekspor</button></div><progress id="pbMovieProgress" max="1" value="0"></progress><p id="pbMovieStatus" role="status">Video tanpa audio · 1–120 detik, maksimal 120 MB. Ekspor per-frame jika encoder tersedia; fallback waktu nyata. Biarkan jendela terlihat.</p></div>`;
  root.append(panel);
  const $ = (id) => panel.querySelector('#' + id);
  let view = { ...MOVIE_DEFAULTS },
    keys = [],
    time = 0,
    duration = 10,
    fps = 24,
    size = '1280x720',
    interpolation = 'smooth',
    playing = false,
    recording = false,
    raf = 0,
    clock = 0,
    origin = 0,
    controller;
  const safe = (fn) => {
    try {
      return fn();
    } catch (e) {
      $('pbMovieStatus').textContent = e.message;
      notify(e.message);
    }
  };
  function fields() {
    for (const e of panel.querySelectorAll('[data-movie]')) {
      const value = view[e.dataset.movie];
      if (e.type === 'checkbox') e.checked = value;
      else e.value = value;
    }
  }
  function markers() {
    $('pbMovieMarkers').replaceChildren(
      ...keys.map((k, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = '◆';
        b.style.left = (k.time / duration) * 100 + '%';
        b.title = 'Titik ' + (i + 1) + ' · ' + k.time.toFixed(2) + ' s';
        b.setAttribute('aria-label', b.title);
        b.setAttribute('aria-pressed', String(Math.abs(time - k.time) < 0.001));
        b.onclick = () => seek(k.time);
        return b;
      }),
    );
    $('pbMovieKeyStatus').textContent =
      keys.length +
      ' titik · drag kamera/scroll untuk sudut berikutnya. Tambah pada waktu sama memperbarui titik.';
  }
  function display() {
    $('pbMovieTime').value = time.toFixed(2);
    $('pbMovieScrub').value = time;
    markers();
  }
  function pause() {
    playing = false;
    cancelAnimationFrame(raf);
    $('pbMoviePlay').disabled = recording;
  }
  function seek(t) {
    safe(() => {
      if (!Number.isFinite(t)) throw Error('Waktu tidak valid.');
      const old = time;
      time = Math.max(0, Math.min(duration, t));
      const frame = sampleMovie(keys, time, interpolation);
      if (frame) {
        view = clone(frame);
        fields();
        applyFrame(view, false);
      }
      sample(time, old, $('pbMovieAnimate').checked);
      display();
    });
  }
  function play() {
    if (recording) return;
    safe(() => {
      if (!keys.length) throw Error('Tambahkan setidaknya satu titik kamera.');
      pause();
      if (time >= duration) seek(0);
      playing = true;
      origin = time;
      clock = performance.now();
      $('pbMoviePlay').disabled = true;
      const step = (now) => {
        if (!playing) return;
        seek(Math.min(duration, origin + (now - clock) / 1000));
        if (time >= duration) {
          pause();
          return;
        }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
  }
  function snapshot() {
    return validateMovie({
      version: 1,
      animate: $('pbMovieAnimate').checked,
      duration,
      fps,
      size,
      interpolation,
      time,
      keys: clone(keys),
      view: clone(getFrame()),
    });
  }
  function restore(state) {
    pause();
    const s = validateMovie(clone(state));
    ({ duration, fps, size, interpolation, time, keys, view } = s);
    $('pbMovieAnimate').checked = s.animate ?? true;
    $('pbMovieDuration').value = duration;
    $('pbMovieFps').value = fps;
    $('pbMovieSize').value = size;
    $('pbMovieBlend').value = interpolation;
    for (const id of ['pbMovieTime', 'pbMovieScrub']) $(id).max = duration;
    fields();
    display();
    applyFrame(view);
    layout();
  }
  for (const e of panel.querySelectorAll('[data-movie]'))
    e.oninput = () =>
      safe(() => {
        pause();
        const next = {
          ...getFrame(),
          [e.dataset.movie]:
            e.type === 'checkbox'
              ? e.checked
              : e.type === 'color' || e.dataset.movie === 'shadowMode'
                ? e.value
                : Number(e.value),
        };
        validateMovie({ ...snapshot(), view: next });
        view = next;
        applyFrame(view);
      });
  $('pbMovieKey').onclick = () =>
    safe(() => {
      pause();
      const at = Math.min(duration, Math.round(time * fps) / fps);
      keys = setMovieKey(keys, at, getFrame());
      time = at;
      display();
    });
  $('pbMovieDelete').onclick = () => {
    pause();
    keys = keys.filter((k) => Math.abs(k.time - time) > 0.5 / fps);
    markers();
  };
  $('pbMovieDuration').onchange = () =>
    safe(() => {
      const n = Number($('pbMovieDuration').value);
      if (!Number.isFinite(n) || n < 1 || n > 120 || keys.some((k) => k.time > n)) {
        $('pbMovieDuration').value = duration;
        throw Error(
          'Durasi 1–120 detik. Hapus/pindahkan titik di luar durasi baru terlebih dahulu.',
        );
      }
      duration = n;
      time = Math.min(time, n);
      for (const id of ['pbMovieTime', 'pbMovieScrub']) $(id).max = n;
      display();
    });
  $('pbMovieFps').onchange = () => {
    fps = Number($('pbMovieFps').value);
  };
  $('pbMovieSize').onchange = () => {
    size = $('pbMovieSize').value;
    layout();
  };
  $('pbMovieBlend').onchange = () => {
    interpolation = $('pbMovieBlend').value;
  };
  $('pbMovieTime').onchange = () => {
    pause();
    seek(Number($('pbMovieTime').value));
  };
  $('pbMovieScrub').oninput = () => {
    pause();
    seek(Number($('pbMovieScrub').value));
  };
  $('pbMoviePlay').onclick = play;
  $('pbMovieStop').onclick = pause;
  $('pbMovieClose').onclick = () => {
    pause();
    panel.hidden = true;
    layout();
  };
  $('pbMovieMinimize').onclick = () => {
    const b = $('pbMovieBody');
    b.hidden = !b.hidden;
    $('pbMovieMinimize').textContent = b.hidden ? 'Buka' : 'Minimalkan';
    $('pbMovieMinimize').setAttribute('aria-expanded', String(!b.hidden));
  };
  $('pbMovieCancel').onclick = () => controller?.abort();
  $('pbMovieExport').onclick = async () => {
    if (recording) return;
    pause();
    try {
      if (!keys.length) throw Error('Tambahkan titik kamera sebelum ekspor.');
      recording = true;
      controller = new AbortController();
      panel.querySelectorAll('input,select,button').forEach((e) => (e.disabled = true));
      $('pbMovieCancel').disabled = false;
      $('pbMovieProgress').value = 0;
      await exportVideo({
        settings: snapshot(),
        animate: $('pbMovieAnimate').checked,
        signal: controller.signal,
        progress: (p) => {
          $('pbMovieProgress').value = p;
          $('pbMovieStatus').textContent = 'Merekam video · ' + Math.round(p * 100) + '%';
        },
        seek,
      });
    } catch (e) {
      $('pbMovieStatus').textContent = e.message;
      notify(e.message);
    } finally {
      recording = false;
      panel.querySelectorAll('input,select,button').forEach((e) => (e.disabled = false));
      $('pbMovieCancel').disabled = true;
      controller = null;
    }
  };
  fields();
  markers();
  return {
    get view() {
      return view;
    },
    get playing() {
      return playing;
    },
    get recording() {
      return recording;
    },
    get visible() {
      return !panel.hidden;
    },
    get size() {
      return size;
    },
    get time() {
      return time;
    },
    snapshot,
    restore,
    seek,
    pause,
    cancel() {
      pause();
      controller?.abort();
    },
    toggle() {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) {
        view = clone(getFrame());
        fields();
      } else pause();
      layout();
    },
    setTime(t) {
      time = t;
      display();
    },
    status(text) {
      $('pbMovieStatus').textContent = text;
    },
  };
}
