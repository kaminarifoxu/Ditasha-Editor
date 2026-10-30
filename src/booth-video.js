import { muxBoothWebm } from './booth-webm.js';
import { fixWebmDuration } from './webm-duration.js';
async function recordRealtimeVideo({ canvas, duration, fps, frame, signal, progress = () => {} }) {
  if (!Number.isFinite(duration) || duration < 1 || duration > 120 || ![24, 30].includes(fps))
    throw Error('Video maksimal 120 detik, 24/30 FPS.');
  if (!canvas.captureStream || typeof MediaRecorder === 'undefined')
    throw Error('Perekam video tidak tersedia di browser ini.');
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((t) =>
    MediaRecorder.isTypeSupported(t),
  );
  if (!mime) throw Error('Encoder WebM tidak tersedia.');
  let stream,
    recorder,
    total = 0,
    failed;
  const chunks = [];
  const abort = () => {
    failed = new DOMException('Ekspor video dibatalkan.', 'AbortError');
    if (recorder?.state === 'recording') recorder.stop();
  };
  const visibility = () => {
    if (document.hidden) {
      failed = Error(
        'Ekspor dihentikan karena jendela disembunyikan. Biarkan Photo Booth terlihat saat merekam.',
      );
      if (recorder?.state === 'recording') recorder.stop();
    }
  };
  try {
    if (signal?.aborted) throw new DOMException('Ekspor video dibatalkan.', 'AbortError');
    await frame(0);
    stream = canvas.captureStream(0);
    const track = stream.getVideoTracks()[0];
    if (!track?.requestFrame) throw Error('Capture frame manual tidak tersedia.');
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const stopped = new Promise((resolve, reject) => {
      recorder.onstop = resolve;
      recorder.onerror = (e) => {
        failed = e.error || Error('Encoder video gagal.');
        reject(failed);
      };
    });
    stopped.catch(() => {});
    recorder.ondataavailable = (e) => {
      if (!e.data.size) return;
      total += e.data.size;
      if (total > 120 * 1024 ** 2) {
        failed = Error('Video melewati 120 MB. Kurangi durasi/resolusi.');
        if (recorder.state === 'recording') recorder.stop();
      } else chunks.push(e.data);
    };
    signal?.addEventListener('abort', abort, { once: true });
    document.addEventListener('visibilitychange', visibility);
    recorder.start(250);
    const start = performance.now();
    track.requestFrame();
    let next = 1;
    while (!failed) {
      const due = start + (next * 1000) / fps;
      await new Promise((r) => setTimeout(r, Math.max(0, due - performance.now())));
      if (failed) break;
      const elapsed = (performance.now() - start) / 1000;
      if (elapsed >= duration) break;
      await frame(elapsed);
      track.requestFrame();
      progress(Math.min(1, elapsed / duration));
      next = Math.max(next + 1, Math.floor(((performance.now() - start) * fps) / 1000) + 1);
    }
    if (recorder.state === 'recording') recorder.stop();
    await stopped;
    if (failed) throw failed;
    progress(1);
    const blob = new Blob(chunks, { type: 'video/webm' });
    if (!blob.size) throw Error('Encoder tidak menghasilkan video.');
    return new Blob([fixWebmDuration(new Uint8Array(await blob.arrayBuffer()), duration)], {
      type: 'video/webm',
    });
  } finally {
    signal?.removeEventListener('abort', abort);
    document.removeEventListener('visibilitychange', visibility);
    if (recorder?.state === 'recording') recorder.stop();
    stream?.getTracks().forEach((t) => t.stop());
  }
}

export async function recordBoothVideo(options) {
  const { canvas, duration, fps, frame, signal, progress = () => {} } = options;
  if (!Number.isFinite(duration) || duration < 1 || duration > 120 || ![24, 30].includes(fps))
    throw Error('Video maksimal 120 detik, 24/30 FPS.');
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined')
    return recordRealtimeVideo(options);
  const config = {
    codec: 'vp8',
    width: canvas.width,
    height: canvas.height,
    bitrate: 8_000_000,
    framerate: fps,
    latencyMode: 'realtime',
  };
  const supported = await VideoEncoder.isConfigSupported(config).catch(() => ({
    supported: false,
  }));
  if (!supported.supported) return recordRealtimeVideo(options);
  const chunks = [];
  let failure,
    total = 0;
  const encoder = new VideoEncoder({
    output: (chunk) => {
      total += chunk.byteLength;
      if (total > 120 * 1024 ** 2) {
        failure = Error('Video melebihi 120 MB. Kurangi durasi/resolusi.');
        return;
      }
      const bytes = new Uint8Array(chunk.byteLength);
      chunk.copyTo(bytes);
      chunks.push({ bytes, timestamp: chunk.timestamp, key: chunk.type === 'key' });
    },
    error: (e) => {
      failure = e;
    },
  });
  try {
    encoder.configure(config);
    const count = Math.ceil(duration * fps);
    for (let i = 0; i < count; i++) {
      if (signal?.aborted) throw new DOMException('Ekspor video dibatalkan.', 'AbortError');
      if (failure) throw failure;
      await frame(i / fps);
      const timestamp = Math.round((i * 1e6) / fps),
        end = Math.min(Math.round(duration * 1e6), Math.round(((i + 1) * 1e6) / fps));
      const image = new VideoFrame(canvas, { timestamp, duration: end - timestamp });
      try {
        encoder.encode(image, { keyFrame: i % (fps * 2) === 0 });
      } finally {
        image.close();
      }
      while (encoder.encodeQueueSize > 3 && !failure) {
        if (signal?.aborted) throw new DOMException('Ekspor video dibatalkan.', 'AbortError');
        await new Promise((r) => setTimeout(r, 5));
      }
      progress((i + 1) / count);
      await new Promise((r) => setTimeout(r, 0));
    }
    await encoder.flush();
    if (signal?.aborted) throw new DOMException('Ekspor video dibatalkan.', 'AbortError');
    if (failure) throw failure;
    return muxBoothWebm(chunks, { width: canvas.width, height: canvas.height, fps, duration });
  } finally {
    if (encoder.state !== 'closed') encoder.close();
  }
}
