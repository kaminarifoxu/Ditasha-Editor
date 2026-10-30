const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
test('clipping checker warns for layered tops and torso but not unrelated ped', async () => {
  const content = await fs.readFile(path.join(__dirname, '../src/booth-clipping-check.js'), 'utf8');
  const moduleUrl = 'data:text/javascript,' + encodeURIComponent(content);
  const { outfitLayerWarnings } = await import(moduleUrl);
  const actors = [
    {owner: 1,visible:true,category:'tops'},
    {owner: 1,visible:true,category:'torso'},
    {owner: 2,visible:true,category:'pants'},
    {owner: 1,visible:false,category:'vest'},
  ];
  const risks = outfitLayerWarnings(actors, 1);
  assert.equal(risks.length, 1);
  assert.match(risks[0], /torso/);
  assert.deepEqual(outfitLayerWarnings(actors, 2), []);
});
