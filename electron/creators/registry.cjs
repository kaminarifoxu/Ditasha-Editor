'use strict';
const TYPES = Object.freeze(['prop', 'weapon', 'freemode', 'tattoo', 'livery']);
const DEFAULT_FLAGS = Object.freeze(Object.fromEntries(TYPES.map(type => [type, false])));
function validateType(type) {
  if (typeof type !== 'string' || !TYPES.includes(type)) throw Error('Unknown creator type');
  return type;
}
function createRegistry({ flags = {}, capabilities = {} } = {}) {
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)) throw Error('Invalid creator flags');
  for (const [key, value] of Object.entries(flags)) {
    validateType(key);
    if (typeof value !== 'boolean') throw Error('Creator flag must be boolean');
  }
  const enabled = Object.freeze({ ...DEFAULT_FLAGS, ...flags });
  const handlers = new Map();
  function register(type, handler) {
    validateType(type);
    if (handlers.has(type)) throw Error('Creator already registered');
    if (typeof handler !== 'function') throw Error('Creator handler must be a function');
    handlers.set(type, handler);
  }
  function available(type) {
    validateType(type);
    return enabled[type] && capabilities[type]?.ready === true && handlers.has(type);
  }
  function describe() {
    return TYPES.map(type => ({ type, enabled: enabled[type], ready: capabilities[type]?.ready === true, registered: handlers.has(type), available: available(type) }));
  }
  function get(type) {
    if (!available(type)) throw Error('Creator is not available');
    return handlers.get(type);
  }
  return Object.freeze({ register, available, describe, get });
}
module.exports = { TYPES, DEFAULT_FLAGS, createRegistry };
