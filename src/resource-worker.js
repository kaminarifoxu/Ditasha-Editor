import { performResourceJob } from './resource-jobs.js';
self.onmessage = ({ data: { id, kind, buffer, options } }) => {
  try {
    const data = performResourceJob(kind, buffer, options),
      buffers = new Set();
    const visit = (value) => {
      if (value instanceof ArrayBuffer) buffers.add(value);
      else if (ArrayBuffer.isView(value)) buffers.add(value.buffer);
      else if (value && typeof value === 'object') Object.values(value).forEach(visit);
    };
    visit(data);
    self.postMessage({ id, data }, [...buffers]);
  } catch (e) {
    self.postMessage({ id, error: e.message });
  }
};
