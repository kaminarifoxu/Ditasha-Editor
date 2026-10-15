# gridcraft v0.7.0

Unmodified web engine from https://github.com/storytold/gridcraft/releases/tag/v0.7.0
Distributed under MIT. Assets retain the licenses below. DITASHA is independent of the ArtCraft Team.

## LICENSE-MIT

MIT License

Copyright (c) 2026 ArtCraft Team and the GridCraft contributors

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


## ATTRIBUTION.md

# Asset attribution

Every non-code asset in this repository (images, icons, fonts, example files, presets) is listed here with its author, source and licence. `cargo xtask assets` (part of `cargo xtask ci`) fails if an asset file is missing from this table.

**Policy (mandatory):** GridCraft contains **no Microsoft, Adobe, Avid or Autodesk iconography, images, artwork, fonts, templates, themes, table styles or sample files**. Every asset is original work by GridCraft contributors or third-party material under an open licence (OSI open source, public domain / CC0, or Creative Commons that allows redistribution). Screenshots of Microsoft software are never committed. Font files are not added here: shared fonts live in [storytold/craft-fonts](https://github.com/storytold/craft-fonts), an optional build input (`CRAFT_FONTS_DIR`). The one exception is the ArtCraft brand files in `docs/brand/`: ArtCraft trademarks, not open source, used under `docs/brand/LICENSE-brand.txt`.

Generated-in-code art is original and has no file to list: the UI icon set (`crates/ui-egui/src/icons.rs`), themes (`crates/engine/src/cmd/view.rs`), cell styles (`crates/engine/src/cmd/format.rs`), table styles (`crates/engine/src/tables.rs`), chart palettes and the sample workbooks (`crates/engine/src/sample.rs`).

| Asset | Author | Source | Licence | Notes |
|---|---|---|---|---|
| `docs/brand/artcraft-logo.svg` | ArtCraft Team | craftrules `assets/brand/` | ArtCraft brand terms (`docs/brand/LICENSE-brand.txt`) | Trademark, not open source |
| `docs/brand/artcraft-logo.png` | ArtCraft Team | craftrules `assets/brand/` | ArtCraft brand terms | Trademark |
| `docs/brand/artcraft-logo-white.svg` | ArtCraft Team | craftrules `assets/brand/` | ArtCraft brand terms | Trademark |
| `docs/brand/artcraft-logo-white.png` | ArtCraft Team | craftrules `assets/brand/` | ArtCraft brand terms | Trademark |
| `docs/brand/artcraft-mark.svg` | ArtCraft Team | craftrules `assets/brand/` | ArtCraft brand terms | Trademark |
| `docs/brand/artcraft-mark.png` | ArtCraft Team | craftrules `assets/brand/` | ArtCraft brand terms | Trademark |
| `docs/brand/artcraft-mark-black.svg` | ArtCraft Team | craftrules `assets/brand/` | ArtCraft brand terms | Trademark |
| `docs/brand/artcraft-mark-black.png` | ArtCraft Team | craftrules `assets/brand/` | ArtCraft brand terms | Trademark |
| `docs/brand/LICENSE-brand.txt` | (licence text) | craftrules | — | |
| `assets/app-icon/gridcraft.svg` | GridCraft contributors | original (hand-written SVG; `packaging/icons.sh`) | MIT OR Apache-2.0 (`assets/app-icon/LICENSE.txt`) | PLACEHOLDER app icon (ledger page); replaced by the owner's creature art later |
| `packaging/macos/dmg/background.svg` | @XusBadia | original (hand-written SVG, derived from the GridCraft app icon `assets/app-icon/gridcraft.svg`, referenced via `<image>`, not copied; text is outlined glyph paths; `packaging/macos/dmg/generate.py` renders it to `background.tiff`) | MIT OR Apache-2.0 (`LICENSE-MIT`, `LICENSE-APACHE`) | GridCraft macOS DMG window background for the Finder window; added 2026-10-08 |
| `packaging/macos/dmg/background.tiff` | @XusBadia | Rendered from `packaging/macos/dmg/background.svg` by `packaging/macos/dmg/generate.py` | MIT OR Apache-2.0 (`LICENSE-MIT`, `LICENSE-APACHE`) | 1x + 2x HiDPI TIFF for the macOS DMG window; includes the app icon (see its row) and LittleCMS's built-in sRGB profile ("No copyright, use freely") |
| `assets/app-icon/gridcraft-1024.png` | GridCraft contributors | original (hand-written SVG; `packaging/icons.sh`) | MIT OR Apache-2.0 (`assets/app-icon/LICENSE.txt`) | Placeholder icon, rendered from gridcraft.svg |
| `assets/app-icon/gridcraft-macos-512.png` | GridCraft contributors | original (hand-written SVG; `packaging/icons.sh`) | MIT OR Apache-2.0 (`assets/app-icon/LICENSE.txt`) | Placeholder icon, macOS grid render |
| `assets/app-icon/gridcraft.icns` | GridCraft contributors | original (hand-written SVG; `packaging/icons.sh`) | MIT OR Apache-2.0 (`assets/app-icon/LICENSE.txt`) | Placeholder icon, macOS bundle icon |
| `assets/app-icon/gridcraft.ico` | GridCraft contributors | original (hand-written SVG; `packaging/icons.sh`) | MIT OR Apache-2.0 (`assets/app-icon/LICENSE.txt`) | Placeholder icon, Windows exe icon |
| `assets/app-icon/hicolor/16x16/apps/ai.storyteller.gridcraft.png` | GridCraft contributors | original (hand-written SVG; `packaging/icons.sh`) | MIT OR Apache-2.0 (`assets/app-icon/LICENSE.txt`) | Placeholder icon, Linux hicolor render |
| `assets/app-icon/hicolor/24x24/apps/ai.storyteller.gridcraft.png` | GridCraft contributors | original (hand-written SVG; `packaging/icons.sh`) | MIT OR Apache-2.0 (`assets/app-icon/LICENSE.txt`) | Placeholder icon, Linux hicolor render |
| `assets/app-icon/hicolor/32x32/apps/ai.storyteller.gridcraft.png` | GridCraft contributors | original (hand-written SVG; `packaging/icons.sh`) | MIT OR Apache-2.0 (`assets/app-icon/LICENSE.txt`) | Placeholder icon, Linux hicolor render |
| `assets/app-icon/hicolor/48x48/apps/ai.storyteller.gridcraft.png` | GridCraft contributors | original (hand-written SVG; `packaging/icons.sh`) | MIT OR Apache-2.0 (`assets/app-icon/LICENSE.txt`) | Placeholder icon, Linux hicolor render |
| `assets/app-icon/hicolor/64x64/apps/ai.storyteller.gridcraft.png` | GridCraft contributors | original (hand-written SVG; `packaging/icons.sh`) | MIT OR Apache-2.0 (`assets/app-icon/LICENSE.txt`) | Placeholder icon, Linux hicolor render |
| `assets/app-icon/hicolor/128x128/apps/ai.storyteller.gridcraft.png` | GridCraft contributors | original (hand-written SVG; `packaging/icons.sh`) | MIT OR Apache-2.0 (`assets/app-icon/LICENSE.txt`) | Placeholder icon, Linux hicolor render |
| `assets/app-icon/hicolor/256x256/apps/ai.storyteller.gridcraft.png` | GridCraft contributors | original (hand-written SVG; `packaging/icons.sh`) | MIT OR Apache-2.0 (`assets/app-icon/LICENSE.txt`) | Placeholder icon, Linux hicolor render |
| `assets/app-icon/hicolor/512x512/apps/ai.storyteller.gridcraft.png` | GridCraft contributors | original (hand-written SVG; `packaging/icons.sh`) | MIT OR Apache-2.0 (`assets/app-icon/LICENSE.txt`) | Placeholder icon, Linux hicolor render |
| `assets/app-icon/hicolor/scalable/apps/ai.storyteller.gridcraft.svg` | GridCraft contributors | original (hand-written SVG; `packaging/icons.sh`) | MIT OR Apache-2.0 (`assets/app-icon/LICENSE.txt`) | Placeholder icon, copy of gridcraft.svg |
| `assets/app-icon/README.md` | GridCraft contributors | original | MIT OR Apache-2.0 | Icon documentation |
| `assets/app-icon/LICENSE.txt` | (licence text) | original | — | Licence of the app icon files |
| `docs/images/hero-sales.png` | GridCraft contributors | screenshot of GridCraft rendered offscreen (`crates/ui-egui/examples/snapshot.rs`) showing an original sample workbook | MIT OR Apache-2.0 | README screenshot; no third-party content |
| `docs/images/budget.png` | GridCraft contributors | screenshot of GridCraft rendered offscreen (`crates/ui-egui/examples/snapshot.rs`) showing an original sample workbook | MIT OR Apache-2.0 | README screenshot; no third-party content |
| `docs/images/grades-formulas.png` | GridCraft contributors | screenshot of GridCraft rendered offscreen (`crates/ui-egui/examples/snapshot.rs`) showing an original sample workbook | MIT OR Apache-2.0 | README screenshot; no third-party content |
| `docs/images/dark-insert.png` | GridCraft contributors | screenshot of GridCraft rendered offscreen (`crates/ui-egui/examples/snapshot.rs`) showing an original sample workbook | MIT OR Apache-2.0 | README screenshot; no third-party content |
| `docs/images/pivot.png` | GridCraft contributors | screenshot of GridCraft rendered offscreen (`crates/ui-egui/examples/snapshot.rs`) showing an original sample workbook | MIT OR Apache-2.0 | README screenshot; no third-party content |
| `docs/images/format-chart.png` | GridCraft contributors | screenshot of GridCraft rendered offscreen (`crates/ui-egui/examples/snapshot.rs`) showing an original sample workbook | MIT OR Apache-2.0 | README screenshot; no third-party content |
| `docs/images/page-break.png` | GridCraft contributors | screenshot of GridCraft rendered offscreen (`crates/ui-egui/examples/snapshot.rs`) showing an original sample workbook | MIT OR Apache-2.0 | README screenshot; no third-party content |


## docs/brand/LICENSE-brand.txt

ArtCraft brand assets: license

The ArtCraft name, wordmark and mark (the "ArtCraft Marks"), including every file in this
directory in every color, size and format, are owned by the ArtCraft Team. They are trademarks
and are NOT open source. They are not covered by GridCraft's MIT OR Apache-2.0 license, and nothing in
that license, in NOTICE or in any other file of this repository grants any right to them.

Permission

The ArtCraft Team grants a limited, non-exclusive, non-transferable, revocable, royalty-free
permission to use the ArtCraft Marks only:

  1. as part of copies of this repository; and
  2. within GridCraft itself, its documentation and its official builds, to identify GridCraft as made
     by the ArtCraft team and community and to link to getartcraft.com and its community.

Conditions

The permission holds only while every one of these is true:

  - The marks are used exactly as supplied in this directory. Do not redraw, recolor, crop,
    stretch, rotate, animate, outline or add effects to them, extract parts of them, or combine
    them with any other name, mark or artwork.
  - They are used only in the context of GridCraft, and only to say that the ArtCraft team makes it.
    They must never suggest that the ArtCraft Team made, sponsors, endorses, certifies or supports
    any other product, service, fork, modified version, plug-in, organization or person.
  - Neither the marks nor the ArtCraft name appear in the name, logo, icon, domain, social media
    handle, app-store listing, advertising or marketing of anything other than GridCraft.

Forks and modified versions

If you distribute or publish a modified version of GridCraft, or any work derived from it, you must
remove the ArtCraft Marks from it (or replace them with your own) and must not call it ArtCraft or
present it as an ArtCraft product. You may say, in plain text, that your work is based on GridCraft by
the ArtCraft team. A fork kept only to propose changes back to this repository may keep the marks
unchanged.

Everything else

Any use not expressly permitted here needs prior written permission from the ArtCraft Team
(https://getartcraft.com/). The permission ends automatically for anyone who breaks these terms.
All other rights are reserved.

