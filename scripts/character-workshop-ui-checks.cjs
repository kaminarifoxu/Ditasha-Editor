module.exports = async function checkCharacterWorkshops({
  ped,
  model,
  ytd,
  zip,
  restoreOnly = false,
}) {
  const $ = (id) => document.getElementById(id),
    pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const assert = (ok, message) => {
    if (!ok) throw Error(message);
  };
  const wait = async (fn, message) => {
    const until = Date.now() + 40000;
    while (!fn()) {
      if (Date.now() > until) throw Error(message + ': ' + ($('pbStatus')?.textContent || ''));
      await pause(40);
    }
  };
  const files = (input, rows) => {
    const dt = new DataTransfer();
    for (const [name, data] of rows) dt.items.add(new File([new Uint8Array(data)], name));
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  };
  document.querySelector('.workspace-nav [data-page=photobooth]').click();
  await wait(() => !$('pbPed').disabled, 'Photo Booth initial restore');
  if (restoreOnly) {
    $('pbPed').click();
    files($('pbInput'), [['reopened-ped.glb', ped]]);
    await wait(() => !$('pbPed').disabled && $('pbActor').options.length === 1, 'Restore actor');
    assert(
      $('pbEmoteVaultStatus').textContent.includes('1 file emote tersimpan'),
      'Emote source did not survive reopening',
    );
    assert(
      [...$('pbClip').options].some((o) => o.value.startsWith('external:')),
      'Reopened catalog has no saved clip',
    );
    return { restoredAfterReopen: true };
  }
  // Exercise chunk storage using the actual IndexedDB implementation, then leave only a valid YCD fixture.
  const { createEmoteVault } = await import(new URL('../src/emote-vault.js', location.href).href),
    vault = createEmoteVault();
  await vault.clear();
  const big = new Uint8Array(2 * 1024 ** 2 + 19);
  for (let i = 0; i < big.length; i += 317) big[i] = i % 251;
  await vault.save(new File([big], 'chunk-check.ycd'));
  let records = await vault.list();
  const restored = new Uint8Array(await (await vault.load(records[0])).arrayBuffer());
  assert(
    restored.length === big.length && restored.every((n, i) => n === big[i]),
    'Emote chunks changed source bytes',
  );
  await vault.clear();
  $('pbClear').click();
  const originalDesktop = window.ditashaDesktop,
    saves = [];
  window.ditashaDesktop = {
    ...(originalDesktop || {}),
    saveExport: async (payload) => {
      saves.push({ name: payload.name, data: [...new Uint8Array(payload.data)] });
      return { saved: true };
    },
  };
  document.querySelector('.workspace-nav [data-page=weapons]').click();
  $('wdSketch').click();
  await wait(() => $('wdObject').options.length >= 4 && !$('wdExport').disabled, 'Weapon sketch');
  const before = $('wdObject').options.length;
  $('wdPart').click();
  files($('wdInput'), [['test-attachment.glb', ped]]);
  await wait(
    () => $('wdObject').options.length > before && !$('wdExport').disabled,
    'GLB attachment',
  );
  $('wdApplyColor').click();
  $('wdExport').click();
  await wait(
    () => saves.some((s) => s.name.endsWith('.glb')) && !$('wdExport').disabled,
    'Weapon GLB export',
  );
  const gun = saves.find((s) => s.name.endsWith('.glb')),
    buffer = Uint8Array.from(gun.data).buffer;
  assert(new DataView(buffer).getUint32(0, true) === 0x46546c67, 'Weapon GLB magic');
  const length = new DataView(buffer).getUint32(12, true),
    gltf = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, length)));
  assert(
    gltf.meshes.length >= 5 && gltf.nodes.some((n) => n.name === 'test-attachment.glb'),
    'Weapon GLB did not include the imported part',
  );
  assert(
    gltf.materials.some((m) => m.pbrMetallicRoughness?.baseColorFactor?.[0] > 0.5),
    'Weapon material edit was lost',
  );
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = 32;
  textureCanvas.height = 16;
  const textureContext = textureCanvas.getContext('2d');
  textureContext.fillStyle = '#d52222';
  textureContext.fillRect(0, 0, 32, 16);
  const textureBlob = await new Promise((resolve) => textureCanvas.toBlob(resolve, 'image/png'));
  files($('wdTextureInput'), [
    ['design.png', [...new Uint8Array(await textureBlob.arrayBuffer())]],
  ]);
  await wait(() => !$('wdTexture').disabled, 'Weapon texture import');
  $('wdExport').click();
  await wait(
    () => saves.filter((s) => s.name.endsWith('.glb')).length === 2 && !$('wdExport').disabled,
    'Textured weapon GLB',
  );
  const textured = Uint8Array.from(saves.filter((s) => s.name.endsWith('.glb')).at(-1).data).buffer;
  const texturedLength = new DataView(textured).getUint32(12, true),
    texturedJson = JSON.parse(
      new TextDecoder().decode(new Uint8Array(textured, 20, texturedLength)),
    );
  assert(
    texturedJson.images?.length &&
      texturedJson.materials.some((m) => m.pbrMetallicRoughness?.baseColorTexture),
    'Applied weapon texture missing from GLB',
  );
  $('wdUvSave').click();
  await wait(
    () => saves.some((s) => s.name.endsWith('_uv.png')) && !$('wdUvSave').disabled,
    'Weapon UV PNG',
  );
  assert(saves.find((s) => s.name.endsWith('_uv.png')).data[0] === 137, 'UV PNG signature');
  console.log('DITASHA_SNAPSHOT:character-weapons');
  await pause(180);
  document.querySelector('.workspace-nav [data-page=photobooth]').click();
  await wait(() => !$('pbPed').disabled, 'Freemode ready');
  $('pbClear').click();
  const character = document.querySelector('.pb-freemode-character');
  character.open = true;
  files(character.querySelector('[data-files]'), [
    ['mp_m_freemode_01^head_000_r.ydd', model],
    ['mp_m_freemode_01^uppr_000_r.ydd', model],
    ['mp_m_freemode_01^hair_000_u.ydd', model],
    ['mp_m_freemode_01^head_diff_000_a_whi.ytd', ytd],
  ]);
  assert(
    character.querySelector('[data-freemode-part=head]').options.length === 2,
    'Freemode head was not indexed',
  );
  character.querySelector('[data-add]').click();
  await wait(() => !$('pbPed').disabled && $('pbActor').options.length === 1, 'Freemode assembly');
  assert(
    $('pbAssets').textContent.includes('hair_000_u.ydd') &&
      $('pbAssets').textContent.includes('uppr_000_r.ydd'),
    'Freemode body/hair parts missing',
  );
  assert($('pbActor').options.length === 1, 'Freemode parts became separate actors');
  files($('pbClipInput'), [['RPEmotes-test.zip', zip]]);
  await wait(
    () =>
      !$('pbPed').disabled &&
      $('pbEmoteVaultStatus').textContent.includes('1 file emote tersimpan'),
    'Auto-persist emote ZIP',
  );
  assert(
    [...$('pbClip').options].some((o) => o.value.startsWith('external:')),
    'ZIP did not add a playable catalog entry',
  );
  files($('pbClipInput'), [['same-again.zip', zip]]);
  await wait(() => !$('pbPed').disabled, 'Duplicate emote import');
  assert((await vault.list()).length === 1, 'Duplicate emote source was persisted twice');
  console.log('DITASHA_SNAPSHOT:character-freemode');
  await pause(180);
  let state = { running: false, status: 'idle', engine: 'test-engine' },
    payload = null;
  const nativeOriginal = window.ditashaNative;
  const preview = {
    version: 1,
    basis: 'gta-z-up',
    source: false,
    triangles: 1,
    textures: [],
    meshes: [
      {
        name: 'TestHead',
        kind: 'base',
        positions: [-0.1, 0, 1.5, 0.1, 0, 1.5, 0, 0, 1.8],
        uvs: [0, 0, 1, 0, 0.5, 1],
        texture: null,
        alpha: 'opaque',
      },
    ],
    poses: [
      { id: 'rest', label: 'Pose awal' },
      { id: 'head', label: 'Uji kepala' },
    ],
  };
  window.ditashaNative = {
    state: async () => state,
    pick: async (kind) => ({ id: kind + '-test', name: kind + '.glb' }),
    start: async (value) => {
      payload = value;
      state = {
        ...state,
        status: 'success',
        stagedId: 'staged-test',
        previewId: 'preview-test',
        report: {
          ok: true,
          mode: 'garment',
          halfPed: true,
          preview,
          transferQuality: { vertices: 3, influences: 4 },
        },
      };
      return state;
    },
    preview: async () => preview,
  };
  $('openNativeBuild').click();
  $('nbWorkflowHead').click();
  await pause(100);
  document.querySelector('#nbPed [data-pick=ped]').click();
  await pause(60);
  $('nbHeadNative').checked = true;
  $('nbHairScale').value = '1.2';
  $('nbRun').click();
  await wait(
    () => payload && $('nbPedPose').options.length === 2,
    'Head workflow native payload and preview',
  );
  assert(
    payload.mode === 'garment' &&
      payload.headOptions.enabled &&
      payload.headOptions.hairScale === 1.2 &&
      payload.headOptions.native,
    'Head settings not sent to engine',
  );
  assert(
    document.querySelector('.native-build-layout > section #nbViewport'),
    'Head viewport is not in the center column',
  );
  assert(
    document.querySelector('.native-build-layout > aside #nbHalfped'),
    'Head settings are not in the side panel',
  );
  $('nbPedPose').value = 'head';
  $('nbPedPose').dispatchEvent(new Event('change'));
  await pause(120);
  console.log('DITASHA_SNAPSHOT:character-halfped');
  window.ditashaNative = nativeOriginal;
  window.ditashaDesktop = originalDesktop;
  return {
    report: {
      weaponGlbPartImport: true,
      weaponMaterial: true,
      weaponUvPng: true,
      weaponTexture: true,
      freemodeSingleActor: true,
      freemodeHeadHair: true,
      zipAutoSave: true,
      chunkBytesPreserved: true,
      deduplication: true,
      halfPedPayload: true,
      halfPedCenterPreview: true,
    },
    headPayload: payload,
  };
};
