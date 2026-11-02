# DITASHA Asset Workshop — visual card implementation blueprint

Status: design/implementation specification only. This document does not change the Home UI.

## Scope / sources
- Existing Home card registry: `src/home-ui.js` (`workspaces` array; **13** items).
- Target DOM: `.home-workspace-grid`, cards `.home-workspace-card`, `data-home-page`.
- Keep `card.onclick = () => activate(page)` and current page keys unchanged.
- Reference direction: Alipee-style product-forward feature banners; create original DITASHA assets and interface, never reuse Alipee graphics or scripts.

## 13 artwork briefs

| Page id | Card | Banner subject |
|---|---|---|
| logoprop | Logo → Prop 3D | PNG logo transforming into extruded metallic GTA prop, subtle depth grid |
| moddrop | ModDropV | vehicle, ped and clothing assets entering DLC folder/package |
| weapons | AddonWeaponsBuilder | GTA addon weapon in 3D inspection space, clean assembly / parts callouts |
| photobooth | Photo Booth | styled freemode character under studio softbox, photo capture thumbnails |
| fivemtools | YMT & FiveM Tools | YMT/XML/LUA code surface, metadata layers, FiveM resource bundle |
| compressor | Asset Compressor | YTD, MLO, ped/vehicle asset cubes collapsing into compact optimized stack |
| files | File Manager | folder hierarchy and floating 3D thumbnail browser of GTA clothes/vehicles |
| editor | Texture & Model | 3D garment beside UV layout, color tools and shader/material sphere |
| archives | GTA V Explorer | open RPF/OIV archive containing assets, explorer files and preview |
| vehicles | Vehicle Workshop | car body with selectable material, decal livery and lights |
| code | Code Studio | code editor panels LUA, JS, XML, terminal and file tree |
| converter | Converter | source PNG/DDS/GLB files converting to YTD/YDD/YDR through central cube |
| pack | Clothing Pack | organized freemode outfits, YDD/YTD files becoming FiveM resource pack |

Additional optional art: `Auto Rig Ped` (currently not one of the 13 `src/home-ui.js` cards; its workspace exists elsewhere). Draw a neutral freemode rig with bones and clothing mesh. Add to home only after verifying its activation route.

## Visual system
- Dark navy-black backgrounds, emerald accent + restrained DITASHA gold (#D5B444), thin borders and subtle geometry.
- Original illustrations only, baked without card titles, labels, text, CTA or buttons: real HTML text remains selectable, accessible and localizable.
- Desktop: 2 cards/row >=1120px, 1 card/row at smaller content widths; image right 45%, copy left 55%; card min-height ~232-260px.
- Number, title, 2-line summary, formats and CTA `Buka tools`; keyboard focus and hover scale / background glow; honor reduced-motion.
- Use WebP/AVIF optimized images, ~960x540 source each, cap approximate 150-250KB per card if quality permits; lazy load images below viewport, fixed aspect ratio, no layout shift.
- Keep entire card a single button and no nested button; CTA is visually styled span only.
- Text contrast at least WCAG AA; mask/gradient behind left copy; clamp overly long titles on narrow windows.
- Fallback illustration for failed/missing asset loads; preserve tool button and native navigation.

## File layout
- `assets/home-workshop/<page-id>.webp`: one original transparent/composited subject image per card.
- `src/home-workshop-art.js`: mapping of page id -> artwork path / optional accent / alt.
- `src/home-ui.js`: supply artwork as an image within existing button, data-driven; keep `activate(page)`.
- Home-specific styles live in the existing home CSS selector layer; avoid changing shared `.workspace-shell button` defaults.

## Execution
1. Make and visually approve all 13 distinct compositions at matching sizes/style.
2. Store optimized assets under `assets/home-workshop/`; define image fallbacks.
3. Update home card markup, implement 2-column responsive layout, overlay/CTA and focus states.
4. Add optional category filter/search only if user asks; retain 13 existing page ids.
5. Add tests asserting 13 cards and click targets, image existence, keyboard activation, no nested buttons, responsive CSS and reduced-motion handling.
6. Run `npm test`, `npm run build:ui`, Windows packaging smoke test; manually verify on Windows at 1366x768, 1600x900 and 1920x1080, with GPU mode on/off.

## Acceptance
- All existing 13 Home destinations still work.
- All 13 cards have distinct original imagery and stable text.
- No blank cards on failed image fetch.
- Build and CI pass; Home scrolls without horizontal overflow.
- Visual parity tested in the Electron app, not inferred solely from CI.
