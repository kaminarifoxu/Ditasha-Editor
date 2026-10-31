// Conservative, non-destructive clothing-layer checks. Overlap is a risk, not proof of triangle clipping.
const LAYERS = [
  {outer:'tops',inner:'torso',message:'Jaket/baju dan torso dapat saling menembus; pilih torso kompatibel atau sembunyikan mesh di panel outfit.'},
  {outer:'vest',inner:'tops',message:'Vest dan baju mungkin bertabrakan; periksa siluet dari berbagai sudut.'},
  {outer:'pants',inner:'shoes',message:'Celana panjang dan sepatu dapat beririsan di bagian pergelangan.'},
  {outer:'hat',inner:'hair',message:'Topi dan rambut berpotensi saling menembus; periksa bagian kepala.'},
];
export function outfitLayerWarnings(assets, ownerId) {
  const active = assets.filter(a => a.owner === ownerId && a.visible !== false && !a.referenceOnly);
  const categories = new Set(active.map(a => a.category));
  return LAYERS.filter(pair => categories.has(pair.outer) && categories.has(pair.inner))
    .map(pair => pair.message);
}
