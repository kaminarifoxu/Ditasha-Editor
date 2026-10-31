# Bundled Freemode for DITASHA Editor

The Editor can load freemode base models automatically when they are packaged in the app.
Binary GTA assets are intentionally **not** committed to GitHub.

## Windows build with the user's uploaded mp_freemode.zip

1. Extract `DITASHA_Freemode_Source_Bundle.zip` into the repository root. It contains `assets/mp_freemode.zip`.
2. Run `npm ci` and `npm run build:win`.
3. `scripts/prepare-freemode.cjs` unpacks both genders into `assets/freemode-reference/mp_freemode/`.
4. Both installers include this resource folder, outside `app.asar`.
5. The first Clothing Library/Character Maker list call automatically registers `DITASHA Built-in Freemode` once in local userData.

There is no need to choose a source folder in Character Maker after installing this **asset-containing** build. If the build didn't have the ZIP, the import control remains available. Public CI artifacts that do not have the ZIP **do not** include these assets.

## Important limitations

YDD/YTD/YFT assets are original freemode mesh/texture/skeleton references. Head blend and GTA facial morphs are saved as FiveM appearance JSON but **are not yet rendered as shape changes** by the offline Three.js viewer. Keep both gender families separate and verify movement/deformation in Photo Booth before publishing.
