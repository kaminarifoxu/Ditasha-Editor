// Data interchange for FiveM illenium-appearance. This does not approximate GTA facial morph rendering.
export const faceFeatureNames = ['noseWidth','nosePeakHigh','nosePeakSize','noseBoneHigh','nosePeakLowering',
  'noseBoneTwist','eyeBrownHigh','eyeBrownForward','cheeksBoneHigh','cheeksBoneWidth','cheeksWidth',
  'eyesOpening','lipsThickness','jawBoneWidth','jawBoneBackSize','chinBoneLowering',
  'chinBoneLenght','chinBoneSize','chinHole','neckThickness'];
export const overlayNames = ['blemishes','beard','eyebrows','ageing','makeUp','blush',
  'complexion','sunDamage','lipstick','moleAndFreckles','chestHair','bodyBlemishes'];
export function toIlleniumAppearance(character) {
  if (!character || !['male','female'].includes(character.gender)) throw Error('Invalid character');
  const a=character.appearance || {};
  return {
    model:character.gender==='female'?'mp_f_freemode_01':'mp_m_freemode_01',
    headBlend:{shapeFirst:a.shapeFirst||0,shapeSecond:a.shapeSecond||0,shapeThird:0,
      skinFirst:a.skinFirst||0,skinSecond:a.skinSecond||0,skinThird:0,
      shapeMix:a.shapeMix??0.5,skinMix:a.skinMix??0.5,thirdMix:0},
    faceFeatures:Object.fromEntries(faceFeatureNames.map((key,i)=>[key,a.features?.[i]||0])),
    headOverlays:Object.fromEntries(overlayNames.map((key,i)=>[key,{
      style:a.overlays?.[i]||0,opacity:a.overlays?.[i] ? 1 : 0,color:0,secondColor:0
    }])),
    eyeColor:a.eyeColor||0,
    hair:{style:0,color:a.hairColor||0,highlight:0,texture:0},
    components:[],props:[],tattoos:[]
  };
}
export function fromIlleniumAppearance(data) {
  if(!data || !['mp_f_freemode_01','mp_m_freemode_01'].includes(data.model)) throw Error('Model freemode tidak valid.');
  const hb=data.headBlend||{};
  return {
    gender:data.model==='mp_f_freemode_01'?'female':'male',
    appearance:{
      shapeFirst:hb.shapeFirst||0,shapeSecond:hb.shapeSecond||0,
      skinFirst:hb.skinFirst||0,skinSecond:hb.skinSecond||0,
      shapeMix:hb.shapeMix??0.5,skinMix:hb.skinMix??0.5,
      eyeColor:data.eyeColor||0,hairColor:data.hair?.color||0,
      features:faceFeatureNames.map(key=>data.faceFeatures?.[key]||0),
      overlays:overlayNames.map(key=>data.headOverlays?.[key]?.style||0)
    }
  };
}
