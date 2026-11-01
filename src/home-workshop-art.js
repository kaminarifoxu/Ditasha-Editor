// Original SVG illustrations for all thirteen DITASHA home tool banners.
// UI text remains DOM text; illustrations are decorative and offline.
const subjects={
  logoprop:['M38 84 L105 36 170 79 105 128 Z','M105 36 V128 M38 84 L105 116 170 79','3D / PROP'],
  moddrop:['M28 104 L64 59 H145 L178 104 L168 127 H42 Z','M52 101 H158 M63 60 L76 37 H134 L147 60','DLC / PACK'],
  weapons:['M35 70 H164 V86 H112 L103 116 H79 V86 H35 Z','M49 56 H150 M145 47 L167 70','ADD-ON'],
  photobooth:['M72 49 C72 14 126 14 126 49 C126 67 72 67 72 49 Z','M48 137 L58 92 75 75 123 75 141 92 151 137 Z','PHOTO / POSE'],
  fivemtools:['M48 26 H151 V141 H48 Z','M74 63 L60 77 74 91 M121 63 L135 77 121 91 M111 53 L89 102','YMT / LUA'],
  compressor:['M33 57 L91 22 155 57 91 95 Z','M33 57 V110 L91 148 155 110 V57 M91 95 V148','OPTIMIZE'],
  files:['M25 59 H79 L93 40 H172 V133 H25 Z','M43 80 H92 M43 100 H139 M43 118 H118','ASSET / FILE'],
  editor:['M24 37 H168 V133 H24 Z','M96 37 V133 M43 113 L64 58 83 113 M117 61 H147 V92 H117 Z','UV / MODEL'],
  archives:['M27 37 H162 V137 H27 Z','M46 59 H143 M46 79 H116 M46 100 H138 M46 117 H91','RPF / OIV'],
  vehicles:['M24 104 L43 69 H148 L172 104 V125 H24 Z','M56 69 L72 49 H124 L143 69 M49 124 A13 13 0 1 0 75 124 M126 124 A13 13 0 1 0 152 124','VEHICLE'],
  code:['M23 28 H170 V139 H23 Z','M30 49 H164 M76 71 L53 90 76 108 M115 71 L138 90 115 108 M108 66 L85 117','CODE / IDE'],
  converter:['M36 34 H87 V96 H36 Z','M114 78 H162 V140 H114 Z M91 61 L115 61 M109 54 L118 61 109 68','EXPORT'],
  pack:['M29 63 L76 31 120 63 105 81 V136 H46 V81 Z','M121 85 H162 V137 H121 Z M131 103 H151','CLOTHING']
};
export const homeWorkshopIllustration=page=>{
  const [primary,secondary,tag]=subjects[page]||subjects.files;
  return `<svg class="home-banner-art" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 174" aria-hidden="true" focusable="false"><defs><linearGradient id="art-${page}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#63ffd0"/><stop offset="1" stop-color="#1a674c"/></linearGradient><pattern id="grid-${page}" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0 H0 V16" fill="none" stroke="#6afac2" stroke-opacity=".09"/></pattern></defs><rect width="240" height="174" fill="url(#grid-${page})"/><ellipse cx="112" cy="141" rx="83" ry="18" fill="#00b979" opacity=".13"/><circle cx="114" cy="83" r="76" fill="#10b981" opacity=".07"/><g transform="translate(16 8)" stroke="url(#art-${page})" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"><path d="${primary}" fill="#102e29"/><path d="${secondary}" fill="none" stroke="#97ffce" stroke-opacity=".85"/></g><rect x="113" y="137" width="115" height="23" rx="7" fill="#09291e" stroke="#4ce0a0" stroke-opacity=".5"/><text x="170" y="152.5" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="10" letter-spacing="1.2" fill="#8affc8">${tag}</text><path d="M10 26 H40 M199 28 H229 M10 151 H40" stroke="#4df6a4" stroke-opacity=".5" stroke-width="1.5"/><circle cx="213" cy="50" r="2" fill="#a4ffc7"/></svg>`;
};
export const homeWorkshopCount=Object.keys(subjects).length;
