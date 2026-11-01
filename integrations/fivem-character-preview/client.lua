-- Local GTA V freemode native preview; no server-side persistence or broadcast.
local function clamp(v, low, high)
  v = tonumber(v) or 0
  return math.max(low, math.min(high, v))
end
local allowed = {mp_m_freemode_01=true,mp_f_freemode_01=true}
local function apply(data)
  if type(data)~='table' or not allowed[data.model] then
    return false,'Model harus mp_m_freemode_01 atau mp_f_freemode_01'
  end
  local model=joaat(data.model)
  if GetEntityModel(PlayerPedId())~=model then
    RequestModel(model)
    local timeout=GetGameTimer()+6000
    while not HasModelLoaded(model) and GetGameTimer()<timeout do Wait(10) end
    if not HasModelLoaded(model) then return false,'Gagal memuat freemode model' end
    SetPlayerModel(PlayerId(),model)
    SetModelAsNoLongerNeeded(model)
  end
  local ped=PlayerPedId()
  local b=data.headBlend or {}
  SetPedDefaultComponentVariation(ped)
  SetPedHeadBlendData(ped,math.floor(clamp(b.shapeFirst,0,45)),math.floor(clamp(b.shapeSecond,0,45)),
    0,math.floor(clamp(b.skinFirst,0,45)),math.floor(clamp(b.skinSecond,0,45)),0,
    clamp(b.shapeMix,0,1),clamp(b.skinMix,0,1),0.0,false)
  local features=data.faceFeatures or {}
  local keys={'noseWidth','nosePeakHigh','nosePeakSize','noseBoneHigh','nosePeakLowering','noseBoneTwist',
    'eyeBrownHigh','eyeBrownForward','cheeksBoneHigh','cheeksBoneWidth','cheeksWidth','eyesOpening',
    'lipsThickness','jawBoneWidth','jawBoneBackSize','chinBoneLowering','chinBoneLenght',
    'chinBoneSize','chinHole','neckThickness'}
  for i,key in ipairs(keys) do SetPedFaceFeature(ped,i-1,clamp(features[key],-1,1)) end
  local overlays=data.headOverlays or {}
  local names={'blemishes','beard','eyebrows','ageing','makeUp','blush','complexion',
    'sunDamage','lipstick','moleAndFreckles','chestHair','bodyBlemishes','bodyBlemishes'}
  for i,key in ipairs(names) do
    local overlay=overlays[key] or {}
    local index=math.floor(clamp(overlay.style or 255,0,255))
    local count=GetNumHeadOverlayValues(i-1)
    if index~=255 and index>=count then index=255 end
    SetPedHeadOverlay(ped,i-1,index,index==255 and 0 or clamp(overlay.opacity or 1,0,1))
  end
  SetPedEyeColor(ped,math.floor(clamp(data.eyeColor,0,31)))
  SetPedHairColor(ped,math.floor(clamp((data.hair or {}).color,0,63)),math.floor(clamp((data.hair or {}).highlight,0,63)))
  return true,'Head blend dan fitur wajah diterapkan menggunakan native GTA V'
end
RegisterCommand('ditashaface',function()
  SetNuiFocus(true,true)
  SendNUIMessage({type='open'})
end,false)
RegisterNUICallback('apply',function(data,cb)
  local ok,msg=apply(data)
  cb({success=ok,message=msg})
end)
RegisterNUICallback('close',function(_,cb)
  SetNuiFocus(false,false)
  cb({success=true})
end)
CreateThread(function()
  while true do
    Wait(0)
    if IsControlJustPressed(0,322) and IsNuiFocused() then SetNuiFocus(false,false) end
  end
end)
