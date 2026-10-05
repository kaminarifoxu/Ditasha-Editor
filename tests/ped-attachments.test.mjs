import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachmentTexture,
  hairTexturePixels,
  validateAttachments,
} from '../src/ped-attachments.js';
const texture = (name, color) => ({ name, out: new Uint8Array(color), w: 1, h: 1 });
const geometry = {
  positions: new Float32Array(9),
  indices: new Uint16Array([0, 1, 2]),
  diffuseTexture: 'hair_diffuse',
};
function attachment(textures = []) {
  return {
    sourceSize: 20,
    drawable: 0,
    texture: '',
    textures,
    drawables: [
      {
        embeddedTextures: [texture('hair_diffuse', [255, 0, 0, 255])],
        lods: [{ geometries: [geometry] }],
      },
    ],
  };
}
test('Hair resolves its own YTD before embedded materials and allows a manual unmatched texture', () => {
  const t = texture('HAIR_DIFFUSE.dds', [0, 255, 0, 255]);
  const a = attachment([t]);
  assert.equal(attachmentTexture(a, geometry), t);
  assert.equal(attachmentTexture(attachment(), geometry).out[0], 255);
  assert.equal(attachmentTexture(a, { diffuseTexture: 'face_diffuse' }), t);
  a.texture = '0';
  assert.equal(attachmentTexture(a, { diffuseTexture: 'different_material' }), t);
  a.texture = '999';
  assert.equal(attachmentTexture(a, geometry), null);
});
test('Attachment budgets cover all drawables/LODs and dictionaries, counting shared buffers once', () => {
  const a = attachment();
  a.drawables[0].lods.push({ geometries: [geometry] });
  assert.doesNotThrow(() => validateAttachments([a]));
  assert.throws(
    () => validateAttachments(Array.from({ length: 9 }, () => attachment())),
    /8 model/,
  );
  assert.throws(() => validateAttachments([{ ...a, sourceSize: 128 * 1024 * 1024 + 1 }]), /128 MB/);
  assert.throws(
    () => validateAttachments([attachment([{ out: { length: 128 * 1024 * 1024 + 1 } }])]),
    /128 MB/,
  );
  const oversized = { positions: { length: 6000003 }, indices: new Uint16Array(0) };
  const huge = attachment();
  huge.drawables.push({ lods: [{ geometries: [oversized] }] });
  assert.throws(() => validateAttachments([huge]), /2 juta vertex/);
  oversized.positions.length = 0;
  oversized.indices = { length: 6000001 };
  assert.throws(() => validateAttachments([huge]), /6 juta indeks/);
});

test('New single diffuse overrides stale embedded names; ambiguous and auxiliary textures are not guessed', () => {
  const diffuse = texture('hair_diff_040_a_uni', [0, 255, 0, 255]);
  const normal = texture('hair_normal', [128, 128, 255, 255]);
  const specular = texture('hair_s', [0, 0, 0, 255]);
  const a = attachment([diffuse, normal, specular]);
  assert.equal(attachmentTexture(a, geometry), diffuse);
  assert.equal(attachmentTexture(a, { diffuseTexture: null }), diffuse);
  a.textures.push(texture('hair_diff_040_b_uni', [255, 0, 0, 255]));
  assert.equal(attachmentTexture(a, { diffuseTexture: 'missing' }), null);
  assert.equal(attachmentTexture(a, geometry), a.drawables[0].embeddedTextures[0]);
  a.textures = [normal, specular];
  assert.equal(attachmentTexture(a, { diffuseTexture: 'missing' }), null);
});
test('Alpha preserves black hair by default; optional colour key edits only the preview copy', () => {
  const t = texture('hair', [0, 0, 0, 255, 4, 8, 6, 180, 0, 255, 0, 255, 50, 50, 50, 0]);
  assert.deepEqual([...hairTexturePixels(t)], [...t.out]);
  assert.deepEqual(
    [...hairTexturePixels(t, true)],
    [0, 0, 0, 0, 4, 8, 6, 0, 0, 255, 0, 255, 50, 50, 50, 0],
  );
  assert.equal(t.out[3], 255);
});
