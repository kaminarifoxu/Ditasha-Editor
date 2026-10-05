# DITASHA Editor

© 2026 Ditasha-Workshop

Editor YTD dan preview YFT/YDD/YDR GTA V Legacy untuk Windows 10/11 64-bit.
Unduh DITASHA-Editor.exe dari Releases dan buka langsung tanpa instalasi.
Logo, tema sakura, font, dan editor disertakan untuk penggunaan offline.

## Fitur

YFT/YDD/YDR: preview geometri statis, UV, wireframe dan foto 3D.
YTD: DXT1/3/5, BGRA/RGBA; ekspor BGRA tanpa kompresi, satu mipmap.
Layer gambar dan YTD: geser, resize 8 titik, rotate, crop, mirror,
opacity, kuas, penghapus, urutan, duplikat, kunci, undo/redo dan tab.
UV biru tidak ikut diekspor. Pengeditan mesh/ekspor YFT/YDD/YDR belum tersedia.
Ekspor desain sebelum menutup; proyek tersimpan di memori selama aplikasi terbuka.

## Update

Aplikasi mengecek GitHub Releases pada startup. Pilih **Update sekarang**
untuk mengunduh rilis stabil, memverifikasi SHA-256, mengganti EXE, dan membuka
aplikasi baru. Unduh otomatis dapat diaktifkan melalui pilihan di dialog.
Ekspor desain sebelum melanjutkan. EXE lama dicadangkan sebagai `.previous`.
Versi 1.3.2 dan sebelumnya yang updater-nya tidak berjalan perlu ditutup dan
EXE-nya diganti manual ke v1.3.3.

Updater mengikuti alur [FiveM Cache Switcher](https://github.com/kaminarifoxu/Fivem-Cache-Switcher/blob/main/ganov/auto_updater.py):
staging terpisah, penantian editor/peluncur, penggantian atomik `File.Replace`,
dan rollback jika peluncuran gagal. `installer.cjs` menjalankan bootstrap
PowerShell yang membuat helper melalui Windows `ProcessStartInfo`. Ini membuat
helper tetap berjalan setelah Electron keluar; proses anak langsung Node
terikat pada job Windows yang dihentikan saat editor keluar.

CI memeriksa unduhan GitHub dengan jaringan Electron asli dan restart EXE
portable hasil build. NSIS menggunakan nama direktori ekstraksi tetap pada
build yang sama; tes memeriksa PID baru dan hilangnya marker runtime lama,
kemudian memastikan EXE tidak terkunci setelah launcher selesai. Folder
ekstraksi NSIS dapat tetap ada setelah proses berakhir.

## Build dan rilis

Jalankan npm ci, npm test, dan npm run build:win di Windows dengan Node.js LTS.
Output: release/DITASHA-Editor.exe. Naikkan version di package.json dan
package-lock.json, perbarui RELEASE_NOTES.md, lalu push ke main. GitHub
Actions membangun EXE dan checksum serta menerbitkan rilis vX.Y.Z otomatis.
Nama EXE tetap sama; versi ditentukan oleh tag rilis dan metadata aplikasi.
Untuk rilis manual sertakan DITASHA-Editor.exe dan DITASHA-Editor.exe.sha256.

Electron 44.5.1 / electron-builder 26.15.3. Kode tidak diberi lisensi
redistribusi umum; dependensi mengikuti lisensinya masing-masing.

## Versi 1.3.1

Loading screen DITASHA saat membuka aplikasi. YFT/YDR Legacy dapat dibuka
sebagai geometri statis dengan UV jika tersedia; animasi dan fisika tidak
ditampilkan. Kompatibilitas format baru diuji dengan resource sintetis.
Dialog perubahan belum disimpan menampilkan daftar tekstur dari seluruh tab.
Status tersimpan baru berubah setelah ekspor selesai ditulis; membatalkan
dialog simpan tetap mempertahankan status perubahan. Source UI ada di src/
dan dibangun ulang lewat npm run build:ui.

Referensi struktur Legacy: https://github.com/dexyfex/CodeWalker

## Converter, expanded 3D, clothing packs (1.4.0)

Choose **Converter** in the workspace navigation, select a conversion, add files and press **Convert**. Save results individually or as a ZIP. Images/DDS can be combined into a new Legacy YTD; texture names are taken from filenames and must be unique. DDS export uses RGBA 32-bit. YTD export uses BGRA 32-bit. Both use one mipmap without block compression. DDS input supports DXT1/3/5 and RGBA/BGRA 32-bit; arrays, cube/volume maps and DX10 are rejected.

**Model → GLB** accepts Legacy YDD/YDR/YFT, OBJ (geometry without external MTL textures) and STL. GTA output contains static geometry and UVs; no skeleton, animation, skinning, collision or GTA shader materials. Importing GLB/OBJ/FBX into GTA resource formats is not implemented.

Use **Perbesar 3D** in the model viewer to expand it. Press **Escape** or **Kembali** to restore the workspace.

Choose **Clothing pack**, import clothing files or a complete resource folder, and select the export mode:

- **Replacement**: named YDD/YTD files use existing ped/component slots. Use qualified streaming names such as `mp_m_freemode_01^jbib_000_u.ydd` with its `mp_m_freemode_01^jbib_diff_000_a_uni.ytd` texture. The exporter checks filenames and duplicate paths, warns about missing matching textures, and lets you edit stream output paths.
- **Existing add-on**: import the original YDD/YTD, YMT and `ShopPedApparel` XML `.meta`. The exporter preserves paths, binary payloads and collection IDs and registers each shop meta with `SHOP_PED_APPAREL_META_FILE`. Changing the resource folder name does not rename the internal collection.

The build ZIP includes a resource folder, `stream/`, `fxmanifest.lua`, a README and a JSON inventory with notes and findings. Build saves are tracked: canceling a save leaves the pack unsaved. Pack changes stay in memory until exported; importing the exported folder restores its assets. Validate the result on your FiveM server for collection compatibility and conflicts. New YMT compilation, automatic slot splitting, reservations, ped outfit simulation, DCT/grzy project import and Enhanced output are not implemented. Batch/ZIP exports are limited to 128 MB, with a 64 MB input file limit.

Format references: [CodeWalker texture structures](https://github.com/dexyfex/CodeWalker/blob/master/CodeWalker.Core/GameFiles/Resources/Texture.cs), [Microsoft DDS header](https://learn.microsoft.com/en-us/windows/win32/direct3ddds/dds-header), [FiveM resource manifest](https://docs.fivem.net/docs/scripting-reference/resource-manifest/), [FiveM data files](https://docs.fivem.net/docs/game-references/data-files/).

## Interface (1.5.0)

The editor, converter, clothing pack maker, dialogs and loading screen use a consistent charcoal theme with soft violet accents. Use **Donasi**, beside **Cek update**, to open [Ditasha-Workshop on Saweria](https://saweria.co/itsaminarii) in your default browser. The desktop action only opens that fixed address.
