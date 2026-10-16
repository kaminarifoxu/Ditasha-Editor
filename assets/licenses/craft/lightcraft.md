# lightcraft v0.8.0

Unmodified web engine from https://github.com/storytold/lightcraft/releases/tag/v0.8.0
Distributed under MIT. Assets retain the licenses below. DITASHA is independent of the ArtCraft Team.

## LICENSE-MIT

MIT License

Copyright (c) 2026 ArtCraft Team and the LightCraft contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


## assets/ATTRIBUTION.md

# Asset attribution

Every asset shipped in this repository is listed here (see the asset rules in `AGENTS.md`). No asset may come from
Adobe products. Add an entry in the same commit as the asset.
`cargo xtask assets` (part of `cargo xtask ci`) fails if any image, icon, font, sound, video, raw file or colour profile
in the repository is not matched by a path pattern in the first column (`*` = any characters except `/`; a trailing `/`
covers a whole directory), or if a licence file referenced in the Licence column is missing.

| Path | Asset | Creator | Source | Licence | Added | Modifications |
|---|---|---|---|---|---|---|
| `assets/fonts/Inter-*.ttf` (Regular, Medium, SemiBold) | Inter | Rasmus Andersson | https://github.com/rsms/inter | SIL Open Font License 1.1 (`assets/fonts/OFL-Inter.txt`) | 2026-09-30 | none |
| `assets/app-icon/` (`lightcraft.svg` and the PNG/ICNS/ICO/SVG files derived from it) | LightCraft app icon (lynx) | LightCraft project owner (drawn in ArtCraft) | original work (vectorised from the owner's drawing; see `assets/app-icon/README.md`) | MIT OR Apache-2.0 (`assets/app-icon/LICENSE.txt`) | 2026-10-02 | vectorised to SVG; rendered to PNG/ICNS/ICO by `packaging/icons.sh` |
| `assets/camera-profiles/*.json` | Camera colour profiles (matrix + hue/saturation/value table), built into LightCraft | ILCE-7M4: Harald Hoyer | original work: fitted by `lightcraft-cli calibrate` to the contributor's own raw photos and their in-camera JPEGs (597 ILCE-7M4 photos, 2026); aggregate colour statistics only, no image content; no Adobe or third-party profile data | MIT OR Apache-2.0 | 2026-10-07 | none |
| `packaging/macos/dmg/` (`background.svg`, the `background.tiff` rendered from it by `generate.py`, and the `dmg-layout.DS_Store` layout file) | LightCraft macOS DMG window background | @XusBadia | original work for this repository, derived from the LightCraft app icon (`assets/app-icon/lightcraft.svg`, referenced via `<image>`, not copied); text is outlined Inter / JetBrains Mono glyph paths | MIT OR Apache-2.0 | 2026-10-08 | none (original); used for the Finder window of the macOS DMG, `packaging/macos/dmg/generate.py` renders it to `background.tiff` |
| `assets/camera-profiles/ILCE-7CR.json` | Sony ILCE-7CR camera colour profile (matrix + hue/saturation/value table), built into LightCraft | LightCraft contributors; source photographs supplied by @AlexChambers | original work: fitted by `lightcraft-cli calibrate` to 125 usable ILCE-7CR ARWs (of 131, September 2025 to September 2026, Standard creative style) and their in-camera JPEGs; aggregate colour statistics only, no image content; no Adobe or third-party profile data | MIT OR Apache-2.0 | 2026-10-09 | none |
| `assets/camera-profiles/X-H2S.json`, `assets/camera-profiles/X-T4.json` | Fujifilm camera colour profiles (matrix + hue/saturation/value table), built into LightCraft | LightCraft contributors; source photographs supplied by Sebastian Pfluegelmeier | original work: fitted by `lightcraft-cli calibrate` to 201 X-H2S and 545 X-T4 RAFs and their in-camera JPEGs; aggregate colour statistics only, no image content; no Adobe or third-party profile data | MIT OR Apache-2.0 | 2026-10-08 | none |
| `crates/raw/src/spectral_table.rs` | Camera colour matrices (DNG ColorMatrix1/2 and ForwardMatrix1/2 for Standard Illuminant A and D65) for 52 camera models, and the model alias list | Derived by LightCraft contributors from rawtoaces-data (Academy Software Foundation): camera spectral sensitivities measured by Weta Digital (44 cameras), scitech (7) and Jonathon Irons at the National Physical Laboratory (Nikon D5100); training reflectances; CIE 1931 colour-matching functions (CIE, CC-BY-4.0, as shipped in rawtoaces-data) | https://github.com/AcademySoftwareFoundation/rawtoaces-data, tag v1.1.0, commit 5cfa53707b053594b2d0d48e8019fb56e6582d6c | Apache-2.0 (`LICENSE-APACHE`); the colour-matching functions CC-BY-4.0 | 2026-10-08 | generated by `tools/spectral_camera_table.py`: a 3×3 matrix per illuminant fitted to the spectral data (no measurement copied verbatim); aliases copied from `data/aliases.json`; no Adobe or third-party camera matrix |
| `assets/camera-tone/sony-dro-off.json` | Sony global tone curve with the Dynamic Range Optimizer off (32 knots), built into LightCraft for ARWs shot with DRO on | LightCraft contributors; source photographs by raw.pixls.us contributors | original work: tone curve quantile-matched over the pooled pixel pairs of 12 CC0 raw.pixls.us ARWs (DRO off, Standard creative style; ILCE-3500, -5000, -6600, -7CR, -7M3 ×3, -7S, -9M2, ILCA-77M2, SLT-A57, NEX-F3) and their embedded camera JPEGs; the file lists each source URL and SHA-256 and how the curve was derived (see also `docs/camera-preview-colour.md`); aggregate tone statistics only, no image content; no Adobe or third-party profile data | MIT OR Apache-2.0 (sources CC0) | 2026-10-09 | none |
| `crates/scenes/` (generated images) | Procedural demo photographs | LightCraft contributors | original work (generated at runtime, no source imagery) | MIT OR Apache-2.0 | 2026-09-30 | n/a |
| `crates/ui-egui/src/icons.rs` | UI icons drawn as vector paths in code | LightCraft contributors | original work | MIT OR Apache-2.0 | 2026-09-30 | n/a |
| `docs/images/*-tetons.jpg`, `docs/images/grid-pd.jpg` (screenshots containing it) | "The Tetons and the Snake River" | Ansel Adams (1942), U.S. National Archives | https://commons.wikimedia.org/wiki/File:Adams_The_Tetons_and_the_Snake_River.jpg | Public domain (U.S. federal government work) | 2026-09-30 | developed in LightCraft; shown inside app screenshots |
| `docs/images/*-migrant-mother.jpg`, `docs/images/grid-pd.jpg` | "Migrant Mother" | Dorothea Lange (1936), Farm Security Administration / Library of Congress | https://commons.wikimedia.org/wiki/File:Lange-MigrantMother02.jpg | Public domain (U.S. federal government work) | 2026-09-30 | developed in LightCraft; shown inside app screenshots |
| `docs/images/*-earthrise.jpg`, `docs/images/grid-pd.jpg` | "Earthrise" (AS08-14-2383) | NASA / Bill Anders, Apollo 8 (1968) | https://commons.wikimedia.org/wiki/File:NASA-Apollo8-Dec24-Earthrise.jpg | Public domain (NASA) | 2026-09-30 | developed in LightCraft; shown inside app screenshots |
| `docs/images/*-blue-marble.jpg`, `docs/images/grid-pd.jpg` | "The Blue Marble" (AS17-148-22727) | NASA, Apollo 17 crew (1972) | https://commons.wikimedia.org/wiki/File:The_Earth_seen_from_Apollo_17.jpg | Public domain (NASA) | 2026-09-30 | developed in LightCraft; shown inside app screenshots |
| `docs/images/*.jpg` (UI) | LightCraft application screenshots | LightCraft contributors | original work (captured with `docs/showcase/`) | MIT OR Apache-2.0 | 2026-09-30 | n/a |
| `docs/brand/` (artcraft-logo and artcraft-mark, SVG and PNG) | ArtCraft wordmark and mark | ArtCraft Team | original work (https://getartcraft.com/) | ArtCraft trademark, see `docs/brand/LICENSE-brand.txt` (not open source) | 2026-10-01 | none |
| craft-fonts: optional build input, not files in this repository | BIZ UDPGothic (Regular, Bold), BIZ UDMincho Regular, Shippori Mincho Regular, Noto Sans CJK SC Regular | Morisawa Inc. / The BIZ UDGothic and BIZ UDMincho Project Authors; The Shippori Mincho Project Authors; Google and Adobe (Noto Sans CJK, maintainer-approved exception; see AGENTS.md) (per craft-fonts' attribution) | https://github.com/storytold/craft-fonts/blob/main/ATTRIBUTION.md | SIL Open Font License 1.1 (each font's OFL.txt in craft-fonts; release packages ship it as OFL-<family>.txt) | 2026-10-06 | none; native builds made with `CRAFT_FONTS_DIR` embed the manifest fonts (all official releases); the web build embeds BIZ UDPGothic Regular and ships Noto Sans CJK SC Regular as a separate font file |
| `crates/ui-egui/locales/uk.json`, `crates/ui-egui/locales/uk-formats.json` | Ukrainian interface catalogs | @dmatviichuk with Codex; PhotoCraft, FilmCraft and VectorCraft translation contributors for reused labels | original translations from English source; 337 initial English-key matches reviewed from [PhotoCraft 69c41f3](https://github.com/storytold/photocraft/blob/69c41f3523e147eb215da8c7b4c29b18b35d1c63/crates/ui-egui/src/i18n/uk.tsv), [FilmCraft 4854c27](https://github.com/storytold/filmcraft/blob/4854c277536fe8118257362304b6a7d82d8e704b/crates/ui-egui/src/i18n/uk.tsv), [VectorCraft 4b44265](https://github.com/storytold/vectorcraft/blob/4b44265965fdd6ffedfd6182a892c1a6c360d344/crates/ui-egui/src/i18n/uk.tsv) | MIT OR Apache-2.0 (`LICENSE-MIT`, `LICENSE-APACHE`, also the source repositories' licences) | 2026-10-09 | adapted to LightCraft photo-development context, completed catalogs, reviewed spelling and placeholders |

Notes
- Fonts authored or published by Adobe (Source Sans/Serif/Code, Source Han, …) are not used, even though some are
  OFL-licensed: the asset rule excludes anything from Adobe. Source Sans 3 was removed on 2026-09-30 and replaced by Inter.
- CJK fonts (BIZ UDPGothic, BIZ UDMincho, Shippori Mincho, Noto Sans CJK SC) are not in this repository. They live in
  [storytold/craft-fonts](https://github.com/storytold/craft-fonts), with their licences and attribution in its
  `ATTRIBUTION.md`, and are embedded only in builds made with the optional `CRAFT_FONTS_DIR` build input (all official
  releases). Never commit font files here; add new fonts to craft-fonts (craftrules `standards/fonts.md`).


## docs/brand/LICENSE-brand.txt

ArtCraft brand assets: license

The ArtCraft name, wordmark and mark (the "ArtCraft Marks"), including every file in this
directory in every color, size and format, are owned by the ArtCraft Team. They are trademarks
and are NOT open source. They are not covered by LightCraft's MIT OR Apache-2.0 license, and nothing in
that license, in NOTICE or in any other file of this repository grants any right to them.

Permission

The ArtCraft Team grants a limited, non-exclusive, non-transferable, revocable, royalty-free
permission to use the ArtCraft Marks only:

  1. as part of copies of this repository; and
  2. within LightCraft itself, its documentation and its official builds, to identify LightCraft as made
     by the ArtCraft team and community and to link to getartcraft.com and its community.

Conditions

The permission holds only while every one of these is true:

  - The marks are used exactly as supplied in this directory. Do not redraw, recolor, crop,
    stretch, rotate, animate, outline or add effects to them, extract parts of them, or combine
    them with any other name, mark or artwork.
  - They are used only in the context of LightCraft, and only to say that the ArtCraft team makes it.
    They must never suggest that the ArtCraft Team made, sponsors, endorses, certifies or supports
    any other product, service, fork, modified version, plug-in, organization or person.
  - Neither the marks nor the ArtCraft name appear in the name, logo, icon, domain, social media
    handle, app-store listing, advertising or marketing of anything other than LightCraft.

Forks and modified versions

If you distribute or publish a modified version of LightCraft, or any work derived from it, you must
remove the ArtCraft Marks from it (or replace them with your own) and must not call it ArtCraft or
present it as an ArtCraft product. You may say, in plain text, that your work is based on LightCraft by
the ArtCraft team. A fork kept only to propose changes back to this repository may keep the marks
unchanged.

Everything else

Any use not expressly permitted here needs prior written permission from the ArtCraft Team
(https://getartcraft.com/). The permission ends automatically for anyone who breaks these terms.
All other rights are reserved.

