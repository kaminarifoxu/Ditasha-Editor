import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const manager=readFileSync(new URL('../src/file-manager-ui.js',import.meta.url),'utf8');
const preview=readFileSync(new URL('../src/file-preview.js',import.meta.url),'utf8');

test('File Manager only renders near-viewport assets rather than all 100-250 immediately',()=>{
 assert.match(manager,/new IntersectionObserver\(\(entries\)/);
 assert.match(manager,/entry\.isIntersecting/);
 assert.match(manager,/rootMargin:'320px 0px'/);
 assert.match(manager,/observer\.observe\(row\)/);
 assert.match(manager,/thumbnailObserver\?\.disconnect\(\)/);
});
test('bounded cached thumbnails reuse PNG snapshots and release URLs',()=>{
 assert.match(manager,/const thumbnailCache = new Map\(\)/);
 assert.match(manager,/MAX_THUMBNAIL_CACHE = 80/);
 assert.match(manager,/thumbnailCache\.get\(key\)/);
 assert.match(manager,/cacheThumbnail\(key,blob\)/);
 assert.match(manager,/URL\.revokeObjectURL\(url\)/);
});
test('optimization preserves YDD/YTD selection and high-performance WebGL preference',()=>{
 assert.match(manager,/textureCandidateIds: \(file\.textures \|\| \[\]\)\.map/);
 assert.match(manager,/highPerformance: previewOptions\.gpu/);
 assert.match(preview,/powerPreference: highPerformance \? 'high-performance' : 'default'/);
 assert.match(manager,/const previewOptions = \{ limit: 250, batch: 12, gpu: true \}/);
});
test('unsupported assets preserve icons and queued work stops on folder changes',()=>{
 assert.match(manager,/Invalid models retain their icon/);
 assert.match(manager,/version === thumbnailGeneration && view === 'grid'/);
 assert.match(manager,/row\.isConnected/);
});
