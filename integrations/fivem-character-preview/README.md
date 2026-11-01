# DITASHA Freemode — GTA-native head blend preview

This resource provides **real GTA V facial deformation** in a local FiveM testing session. It is **not** an offline YDD morph implementation: the static Three.js model preview cannot reconstruct Rockstar's proprietary head blend surfaces merely from a skeleton and skin weights.

1. Copy `integrations/fivem-character-preview` into the test server's `resources/[local]/ditasha-character-preview` folder.
2. Add `ensure ditasha-character-preview` to server.cfg and restart the test server.
3. In DITASHA Editor → Character Maker, configure and **Ekspor JSON FiveM**.
4. Join your own test server and type `/ditashaface`.
5. Paste the exported appearance JSON, press **Terapkan pada karakter saya**.
6. Inspect the face from multiple angles. The native applies head blend, all 20 face features, overlays, iris and hair colours.

**Caution:** This changes the local player's freemode model and resets component variations. Test on a development server, not a live server that uses an appearance or spawn manager. It doesn't automatically save to ESX/illenium-appearance or return screenshots to DITASHA Photo Booth. It doesn't include the original GTA proprietary assets.

Native reference: https://github.com/citizenfx/natives/blob/master/PED/SetPedHeadBlendData.md
