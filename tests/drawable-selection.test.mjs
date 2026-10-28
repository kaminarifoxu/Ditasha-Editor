import test from 'node:test';
import assert from 'node:assert/strict';
import { viewerModel } from './viewer-format.test.mjs';
import { componentYddFixture } from './fixtures/component-ydd.mjs';
import { readYdd } from '../src/resource.js';
import {
  defaultDrawableSelection,
  drawableView,
  selectedDrawables,
} from '../src/drawable-selection.js';

test('Fullped component hashes select the complete body while keeping each drawable and source intact', () => {
  const bytes = componentYddFixture(viewerModel),
    saved = new Uint8Array(bytes).slice(),
    ds = readYdd(bytes);
  assert.deepEqual(
    ds.map((d) => d.name),
    ['lowr_000_u', 'teef_000_u', 'head_000_r'],
  );
  assert.equal(defaultDrawableSelection(ds), -1);
  const all = drawableView(ds, -1);
  assert.equal(all.geometries.length, 6);
  assert.equal(
    all.geometries.reduce((n, g) => n + g.positions.length, 0),
    ds.reduce((n, d) => n + d.geometries.reduce((s, g) => s + g.positions.length, 0), 0),
  );
  assert.equal(all.lods.length, 2);
  for (let i = 0; i < 3; i++) {
    assert.equal(drawableView(ds, i), ds[i]);
    assert.equal(selectedDrawables(ds, i).length, 1);
    assert.equal(all.geometries[i * 2].sourceEmbeddedTextures, ds[i].embeddedTextures);
    assert.equal(all.geometries[i * 2].positions, ds[i].geometries[0].positions);
  }
  assert.deepEqual(new Uint8Array(bytes), saved);
});

test('Repeated clothing slots and unknown dictionaries stay individually selected', () => {
  const variants = readYdd(
    componentYddFixture(viewerModel, ['head_000_r', 'head_001_r', 'head_002_r']),
  );
  assert.equal(defaultDrawableSelection(variants), 0);
  assert.equal(drawableView(variants, -1).geometries.length, 6);
  assert.equal(defaultDrawableSelection(readYdd(viewerModel)), 0);
  assert.equal(defaultDrawableSelection([{ componentSlot: 'head' }, { name: 'unknown' }]), 0);
  assert.equal(drawableView([], -1), null);
});

test('Assembled LOD uses each drawable maps and falls back to its high level when a requested LOD is absent', () => {
  const a = {
    name: 'a',
    lods: [
      { name: 'High', geometries: [{ positions: [1] }] },
      { name: 'Low', geometries: [{ positions: [2] }] },
    ],
    embeddedTextures: [{ name: 'same', out: [1] }],
  };
  const b = {
    name: 'b',
    lods: [{ name: 'High', geometries: [{ positions: [3] }] }],
    embeddedTextures: [{ name: 'same', out: [2] }],
  };
  const view = drawableView([a, b], -1);
  assert.deepEqual(
    view.lods.map((l) => l.name),
    ['High', 'Low'],
  );
  assert.deepEqual(
    view.lods[1].geometries.map((g) => g.positions),
    [[2], [3]],
  );
  assert.equal(view.lods[1].geometries[0].sourceEmbeddedTextures, a.embeddedTextures);
  assert.equal(view.lods[1].geometries[1].sourceEmbeddedTextures, b.embeddedTextures);
  assert.equal(a.lods[0].geometries[0].sourceDrawableIndex, undefined);
});
