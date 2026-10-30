# deckcraft v0.7.0

Unmodified web engine from https://github.com/storytold/deckcraft/releases/tag/v0.7.0
Distributed under MIT. Assets retain the licenses below. DITASHA is independent of the ArtCraft Team.

## LICENSE-MIT

MIT License

Copyright (c) 2026 ArtCraft Team and the DeckCraft contributors

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

# Attribution

Every asset DeckCraft includes, bundles, embeds at build time or shows in its documentation, with
its author, source and licence. The policy is in [AGENTS.md](AGENTS.md) §1. `cargo xtask assets`
fails if a file under `assets/`, `docs/images/` or `docs/brand/` is missing from this table.

DeckCraft contains **no Microsoft, Adobe, Avid or Autodesk iconography, images, fonts, themes,
templates or other assets**. Its themes, colour schemes, layouts, preset-shape geometry, sample
deck and UI icons are original work of the DeckCraft contributors (drawn or generated in code).

## In this repository

| Asset | Author | Source | Licence | Used for |
|---|---|---|---|---|
| `docs/brand/artcraft-logo.svg`, `docs/brand/artcraft-logo.png` | ArtCraft Team | ArtCraft brand kit (project owner) | ArtCraft trademark, `docs/brand/LICENSE-brand.txt` (not open source) | README header |
| `docs/brand/artcraft-logo-white.svg`, `docs/brand/artcraft-logo-white.png` | ArtCraft Team | ArtCraft brand kit | ArtCraft trademark, `docs/brand/LICENSE-brand.txt` | README header (dark mode) |
| `docs/brand/artcraft-mark.svg`, `docs/brand/artcraft-mark.png` | ArtCraft Team | ArtCraft brand kit | ArtCraft trademark, `docs/brand/LICENSE-brand.txt` | README footer, About |
| `docs/brand/artcraft-mark-black.svg`, `docs/brand/artcraft-mark-black.png` | ArtCraft Team | ArtCraft brand kit | ArtCraft trademark, `docs/brand/LICENSE-brand.txt` | Mark for light backgrounds |
| `docs/brand/LICENSE-brand.txt` | ArtCraft Team | craftrules `standards/license-files` | — (licence text) | Terms for the ArtCraft marks |
| `assets/app-icon/deckcraft-1024.png`, `assets/app-icon/hicolor/*/apps/ai.storyteller.deckcraft.png` | DeckCraft contributors | rendered by DeckCraft from `assets/app-icon/icon-source.deckcraft` (shapes only) | MIT OR Apache-2.0 | Placeholder app icon (presentation board) until the mascot icon is drawn |
| `packaging/macos/dmg/background.svg` | @XusBadia | DeckCraft macOS DMG window background, original work for this repository (2026-10-08), derived from the DeckCraft app icon `assets/app-icon/deckcraft-1024.png` (referenced via `<image>`, not copied); text is outlined Inter / JetBrains Mono glyph paths | MIT OR Apache-2.0 (`LICENSE-MIT`, `LICENSE-APACHE`) | Finder window of the macOS DMG; `packaging/macos/dmg/generate.py` renders it to `background.tiff` |
| `packaging/macos/dmg/background.tiff` | @XusBadia | Rendered from `packaging/macos/dmg/background.svg` by `packaging/macos/dmg/generate.py` | MIT OR Apache-2.0 (`LICENSE-MIT`, `LICENSE-APACHE`) | 1x + 2x HiDPI TIFF for the macOS DMG window; includes the app icon (see its row) and LittleCMS's built-in sRGB profile ("No copyright, use freely") |
| `assets/app-icon/deckcraft.icns`, `assets/app-icon/deckcraft.ico` | DeckCraft contributors | generated from the PNGs above by `packaging/icons.sh` (sips/iconutil, `cargo xtask ico`) | MIT OR Apache-2.0 | macOS and Windows app icons |
| `assets/app-icon/hicolor/scalable/apps/ai.storyteller.deckcraft.svg` | DeckCraft contributors | the shapes of `assets/app-icon/icon-source.deckcraft` written out as SVG (same coordinates, colours and corner radii) | MIT OR Apache-2.0 | Scalable app icon for Linux desktops (hicolor theme) |
| `assets/app-icon/icon-source.deckcraft` | DeckCraft contributors | made with `deckcraft-cli run` (see git history) | MIT OR Apache-2.0 | Source of the placeholder icon |
| `docs/images/editor.png`, `docs/images/shape-format.png`, `docs/images/format-pane.png`, `docs/images/slide-sorter.png`, `docs/images/dark-mode.png`, `docs/images/sample-deck.png` | DeckCraft contributors | Screenshots of DeckCraft and slides rendered by `deckcraft-cli` from the built-in sample deck (original content; Inter font, OFL-1.1) | MIT OR Apache-2.0 | README screenshots |
| `crates/media/tests/fixtures/tone*` (`tone.mp3`, `.m4a`, `.aac`, `.ogg`, `.opus`, `.flac`, `.wma`, `tone-alac.m4a`) | DeckCraft contributors | synthesised 0.5 s 440 Hz sine, encoded by `crates/media/tests/fixtures/make.sh` (ffmpeg as the encoder only) | CC0-1.0 | Audio decoding tests |
| `crates/media/tests/fixtures/clip-*` (`clip-h264.mp4`, `clip-h264.mov`, `clip-hevc.mp4`, `clip-vp9.webm`, `clip-av1.mkv`) | DeckCraft contributors | 6 frames of a colour gradient generated by `make.sh` (python3), encoded by ffmpeg (x264 / x265 / libvpx / SVT-AV1 as encoders only) | CC0-1.0 | Video decoding tests |
| `crates/media/tests/fixtures/make.sh` | DeckCraft contributors | this repository | MIT OR Apache-2.0 | Regenerates the media fixtures |
| `crates/render/tests/fixtures/colr-squares.ttf` | DeckCraft contributors | two squares as a COLRv0/CPAL test font, built by `make_colr_font.py` (fontTools as the builder only) | CC0-1.0 | Colour glyph rendering tests |
| `crates/fonts/tests/fixtures/legacy-semibold.ttf` | DeckCraft contributors | a one-glyph Semibold face named like Segoe UI Semibold (its Windows family differs from the typographic one), built by `make_legacy_font.py` (fontTools as the builder only) | CC0-1.0 | Font lookup by Windows family name tests |
| `crates/fonts/tests/fixtures/legacy-regular.ttf` | DeckCraft contributors | the same family's one-glyph Regular face, built by `make_legacy_font.py` (fontTools as the builder only) | CC0-1.0 | Font lookup by Windows family name tests |
| `crates/render/tests/fixtures/make_colr_font.py` | DeckCraft contributors | this repository | MIT OR Apache-2.0 | Regenerates the COLR test font |

## Bundled through dependencies

| Asset | Author | Source | Licence | Used for |
|---|---|---|---|---|
| Ubuntu Light (`Ubuntu-Light.ttf`, via the `epaint_default_fonts` crate 0.36) | Dalton Maag Ltd for Canonical | https://crates.io/crates/epaint_default_fonts | Ubuntu Font Licence 1.0 | Last-resort text face when no other font is available; UI fallback |
| Hack Regular, Noto Emoji, emoji-icon-font (via `epaint_default_fonts` / egui) | Source Foundry; Google; Jakub Steiner et al. | https://crates.io/crates/epaint_default_fonts | MIT / Bitstream-Vera, OFL-1.1, MIT | egui UI fallback glyphs |

## Embedded at build time from craft-fonts (`CRAFT_FONTS_DIR`)

Release builds (and local builds with a craft-fonts checkout) embed the fonts listed in
[craft-fonts](https://github.com/storytold/craft-fonts) `fonts/latin-manifest.txt` and
`fonts/manifest.txt` (per-file authors, sources, SHA-256 and licences in its
[ATTRIBUTION.md](https://github.com/storytold/craft-fonts/blob/main/ATTRIBUTION.md)), except the
families excluded by `crates/fonts/build.rs`:

| Families | Licence | Notes |
|---|---|---|
| Inter | OFL-1.1 | Default theme font |
| Carlito, Caladea | OFL-1.1 | Metric-compatible stand-ins for documents that ask for Calibri / Cambria |
| Liberation Sans, Serif, Mono | OFL-1.1 | Metric-compatible stand-ins for Arial, Times New Roman, Courier New |
| Montserrat, Lato, Open Sans, Roboto, Merriweather, Playfair Display, Poppins, Nunito Sans | OFL-1.1 | Theme fonts |
| BIZ UDPGothic, BIZ UDMincho, Shippori Mincho, Noto Sans Arabic | OFL-1.1 | Japanese and Arabic text |

Web (wasm32) builds embed only Inter Regular/Bold and BIZ UDPGothic Regular.


## docs/brand/LICENSE-brand.txt

ArtCraft brand assets: license

The ArtCraft name, wordmark and mark (the "ArtCraft Marks"), including every file in this
directory in every color, size and format, are owned by the ArtCraft Team. They are trademarks
and are NOT open source. They are not covered by DeckCraft's MIT OR Apache-2.0 license, and nothing in
that license, in NOTICE or in any other file of this repository grants any right to them.

Permission

The ArtCraft Team grants a limited, non-exclusive, non-transferable, revocable, royalty-free
permission to use the ArtCraft Marks only:

  1. as part of copies of this repository; and
  2. within DeckCraft itself, its documentation and its official builds, to identify DeckCraft as made
     by the ArtCraft team and community and to link to getartcraft.com and its community.

Conditions

The permission holds only while every one of these is true:

  - The marks are used exactly as supplied in this directory. Do not redraw, recolor, crop,
    stretch, rotate, animate, outline or add effects to them, extract parts of them, or combine
    them with any other name, mark or artwork.
  - They are used only in the context of DeckCraft, and only to say that the ArtCraft team makes it.
    They must never suggest that the ArtCraft Team made, sponsors, endorses, certifies or supports
    any other product, service, fork, modified version, plug-in, organization or person.
  - Neither the marks nor the ArtCraft name appear in the name, logo, icon, domain, social media
    handle, app-store listing, advertising or marketing of anything other than DeckCraft.

Forks and modified versions

If you distribute or publish a modified version of DeckCraft, or any work derived from it, you must
remove the ArtCraft Marks from it (or replace them with your own) and must not call it ArtCraft or
present it as an ArtCraft product. You may say, in plain text, that your work is based on DeckCraft by
the ArtCraft team. A fork kept only to propose changes back to this repository may keep the marks
unchanged.

Everything else

Any use not expressly permitted here needs prior written permission from the ArtCraft Team
(https://getartcraft.com/). The permission ends automatically for anyone who breaks these terms.
All other rights are reserved.

