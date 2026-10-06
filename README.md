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
Ekspor desain sebelum melanjutkan. EXE lama dicadangkan sementara sebagai `.previous`, lalu dihapus setelah
workspace aplikasi baru berhasil terbuka. Jika startup update gagal, helper
memulihkan EXE lama. Cadangan dari updater lama dibersihkan setelah startup
aplikasi baru berhasil.
Versi 1.3.2 dan sebelumnya yang updater-nya tidak berjalan perlu ditutup dan
EXE-nya diganti manual ke v1.3.3.

Updater mengikuti alur [FiveM Cache Switcher](https://github.com/kaminarifoxu/Fivem-Cache-Switcher/blob/main/ganov/auto_updater.py):
staging terpisah, penantian editor/peluncur, penggantian atomik `File.Replace`,
dan rollback jika peluncuran gagal. `electron/installer.cjs` menjalankan bootstrap
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
package-lock.json, perbarui docs/RELEASE_NOTES.md, lalu push ke main. GitHub
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

## Archive workspace (1.6.0)

Open **Archive → Open archive** for GTA V RPF7, OIV or ZIP files. Browse folders,
search paths and select an asset to extract it or open it in Texture & Model.
Unencrypted RPF files use OPEN/NONE headers; ZIP/OIV supports Stored and Deflate.
AES/NG archives and encrypted scripts require game encryption keys and are unsupported.

Use **Add files**, **Replace file** or **Remove file**, then **Save archive copy**.
RPF exports are rebuilt as OPEN RPF7. OIV/ZIP files are rebuilt as ZIP containers.
Canceling a save leaves changes unsaved. Original files are not automatically overwritten.
To edit a texture, open it in the editor, export the changed asset, then replace it
in Archive. Nested archives export separately; replace the exported RPF in its parent.
OIV metadata and installation instructions can be inspected; scripts are not executed.
The existing assembly.xml is preserved. Update its references if package contents change.
Empty directories are omitted during export.

Archive directory browsing uses file slices rather than loading the whole archive.
Extraction/rebuilt archives are limited to 128 MB. Replacements and editor imports
are limited to 64 MB, and individual resource payloads in rebuilt RPFs must be under 16 MB.
ZIP64, multipart, password-protected archives and symlinks are unsupported.

Format references:

- https://github.com/OpenIV-Team/OpenIV-PackageFormat/blob/master/specification/versions/2.2.md
- https://github.com/dexyfex/CodeWalker/blob/master/CodeWalker.Core/GameFiles/RpfFile.cs

This feature is implemented in DITASHA; OpenIV itself is not bundled.

## GTA V viewers and Explorer (1.7.0)

**Texture viewer** opens YTD dictionaries, DDS or images. Search textures, choose
Grid/List and thumbnail sizes, inspect dimensions/format/mip count, change the alpha
background, and view at original size or zoom. Export one texture as PNG/DDS or all
textures in a ZIP. DDS exports use uncompressed RGBA and one mip level.

**Model viewer** opens Legacy YFT/YDD/YDR models and available High/Medium/Low/Very-low
LODs. Select drawables, show/hide individual model parts, toggle grid/wireframe/points/
geometry bounds, use front/side/top cameras and save a PNG snapshot. Diffuse sampler
references are matched by texture name against embedded textures and external YTDs.
Use **+ Textures** to add dictionaries or images; remove external textures with ×.
Missing diffuse textures are listed in the status. The viewer uses orbit/pan/zoom controls.

**GTA V Explorer → Open folder** opens loose assets or a GTA V folder locally. It indexes
file handles without loading every file. Folders are read-only. Double-click a model,
texture or archive to open it. Explicit Texture Viewer/Model Viewer buttons are also
available. Same-name YTD files in the same folder/archive are loaded with models.
Sort by name/type/size in either direction, inspect UTF-8 text or paged hex, and copy
names/relative paths. The inspector previews at most 1 MB (text: first 256 KB).
**New RPF** creates an OPEN RPF7; add files, then export a copy. Turn off **Edit archive**
for read-only archive browsing. Stored nested RPFs are browsed using file slices.

Viewers are independently implemented in DITASHA; the uploaded OpenIV program has
compiled binaries and configuration rather than source files. No OpenIV program,
plugins, assets, shader database, or non-GTA-V game data are distributed in DITASHA.

These viewers display static geometry and diffuse textures. They do not reproduce
OpenIV's full feature set: skeleton animation/skinning, bone/physics fragment transforms,
collision editing, damage simulation, advanced game shaders and native model writing
are unsupported. Complex vehicles/skinned models can appear incomplete. Geometry
bounds show mesh extents, not collision data. Encrypted/Enhanced assets remain unsupported.
Each viewer file is limited to 64 MB; decoded textures to 128 MB; model buffers to
2 million vertices and 6 million indices. Viewer rendering requires WebGL.

Binary-layout reference: https://github.com/dexyfex/CodeWalker/blob/master/CodeWalker.Core/GameFiles/Resources/Drawable.cs

## Struktur kode

| Folder      | Isi                                                               |
| ----------- | ----------------------------------------------------------------- |
| `electron/` | Main process, preload, IPC, updater dan installer Windows         |
| `src/`      | Sumber editor, parser format, viewer, converter dan clothing pack |
| `ui/`       | HTML, CSS, splash screen dan aset antarmuka                       |
| `assets/`   | Ikon aplikasi untuk build Windows                                 |
| `tests/`    | Pengujian format, arsip, keamanan IPC dan updater                 |
| `scripts/`  | Pemeriksaan UI, pengujian EXE portable dan checksum               |
| `docs/`     | Catatan rilis                                                     |

Jalankan `npm run format` setelah mengubah kode, lalu `npm run format:check`,
`npm test` dan `npm run build:ui` sebelum mengirim perubahan. Bundle
`ui/app.js` dihasilkan otomatis; ubah sumber di `src/`. GitHub Actions
memeriksa format, pengujian, viewer dan proses penggantian EXE sebelum rilis.

## Rambut ped pada preview (1.8.0)

Di **Texture & Model**, buka model muka/ped lalu buka **Rambut ped · YDD + YTD**
di inspector kanan. Pilih **Tambah rambut YDD / YTD** dan satu file YDD rambut
beserta YTD-nya (YTD boleh dimuat belakangan lewat **Ganti YTD rambut**).
Pilih drawable rambut dan tekstur manual bila nama material tidak cocok.
Atur posisi X (kanan), Y (atas), Z (depan), rotasi dan skala bila belum sejajar.
Posisi memakai koordinat preview setelah konversi sumbu GTA.

Rambut ditampilkan bersama muka dengan material terpisah: mengganti tekstur
muka tidak mengubah tekstur rambut. Bisa ditampilkan/disembunyikan, dihapus,
di-reset posisinya dan ikut dalam foto 3D. Panel yang sama tersedia di
**Model viewer**. Model dasar baru mengosongkan rambut; pergantian tekstur
dan drawable model dasar mempertahankan rambut. Hingga 8 model tambahan.

Preview menggunakan geometri statis dan LOD tertinggi yang tersedia. Tidak
ada pengikatan otomatis ke tulang kepala, animasi/skinning atau ekspor ped
gabungan. Konfigurasi hanya tersimpan selama preview; tidak ikut ekspor YTD.

### Perbaikan rambut dan updater (1.8.1)

Setelah YDD rambut dimuat, YTD boleh dipilih sendiri melalui **Tambah rambut**
atau **YTD ke rambut terpilih**. Gunakan **Tujuan YTD rambut** jika ada
beberapa model rambut. YTD mengganti dictionary milik rambut terpilih saja;
model, posisi dan material muka tetap dipertahankan.

### Preview rambut (1.8.2)

Pilih **Tujuan YTD rambut** sebelum menambahkan YTD. Diffuse tunggal diterapkan meskipun nama variasinya berbeda; untuk YTD dengan beberapa diffuse pilih **Tekstur rambut** secara manual. Normal/specular tidak dipilih sebagai fallback warna. Tekstur muka tetap terpisah.

**Hapus rambut terpilih**, **Hapus semua rambut**, dan **Hapus YTD rambut** hanya membersihkan preview; file asli tetap aman. Hair cards memakai **Cutout** dengan **Batas alpha** yang dapat disesuaikan; **Blend** tersedia untuk alpha lembut. Jika gambar memiliki latar hitam tanpa alpha, **Hilangkan latar hitam** bisa dicentang, tetapi juga menghilangkan helai hitam. Biarkan mati untuk rambut hitam asli. Ini preview statis, bukan implementasi lengkap shader/bone GTA V.

### Material ped, alis dan bulu mata (1.8.3)

Di Texture & Model dan Model Viewer, buka **Material ped · alis & alpha**. Cutout memakai alpha tekstur secara default. Pilih **Bagian model** untuk mengubah alis/bulu mata saja, lalu atur **Batas alpha**, atau pilih **Blend** / **Opaque**. **Hilangkan latar hitam** tersedia untuk tekstur tanpa alpha, tetapi juga menghapus warna hitam asli pada bagian yang dipilih. **Reset material terpilih** mengembalikan Cutout 0,25 tanpa penghapusan hitam. Pengaturan hanya untuk preview, terpisah dari rambut tambahan, dan tidak mengubah gambar atau ekspor. YTD baru dengan nama tekstur sama menggantikan tekstur lama di Model Viewer.

### UI minimal (1.9.0)

Aksi kuas, hapus, duplikat, zoom, kamera, viewer dan arsip memakai Uicons Flaticon. Arahkan mouse ke ikon untuk tooltip; tombol tetap memiliki nama aksesibel dan fokus keyboard. Nama workspace, format ekspor dan status penting tetap terlihat. Penjelasan panjang tersedia pada bagian Petunjuk/Tentang yang dapat dibuka. Font ikon tertanam di aplikasi dan bekerja tanpa internet. Kredit: **Uicons by Flaticon** di footer dan Panduan; detail di [docs/ICONS.md](docs/ICONS.md).

### Photoshoot katalog

Buka model ped, rambut, baju, celana, atau vest di **Texture & Model** atau **Model viewer**, lalu pasang YTD/teksturnya. Klik **Photoshoot** di toolbar 3D (juga tersedia pada preview Clothing pack). Studio memakai model aktif beserta rambut dan materialnya dalam tiga sudut: preset ped kiri/depan/kanan, atau pakaian depan/belakang/depan. Ini tiga tampilan model yang sama, bukan tiga slot model berbeda.

Atur sudut masing-masing panel, arah depan, tinggi kamera, dan ukuran model. Tambahkan background PNG/JPG/WebP, logo, judul, dan caption. Background dapat berupa warna atau transparan. Pilih resolusi hingga 3000 × 2000 lalu **Simpan PNG** untuk katalog/Discord. Grid, wireframe, dan penanda vertex tidak ikut difoto; pengaturan editor asli tidak diubah. Mode ini menggunakan preview mesh statis yang tersedia; tidak menambahkan pose/animasi ped.

### Kendaraan dan PNG pada 3D (v1.11.0)

Model viewer mendukung impor beberapa model, pemilihan extra/livery YFT, kontrol setiap mesh, dan pemilihan tekstur/UV untuk diffuse preview. Error YTD `Format tekstur 1c belum didukung` ditangani dengan decoder A8. Di Texture & Model, **PNG 3D** menempelkan stiker pada permukaan mesh, tanpa mengubah kanvas 2D; bisa diatur ukuran/rotasi/opacity dan ikut difoto atau Photoshoot. Stiker 3D belum dibake ke YTD. Lihat [cara pakai dan batas preview](docs/VEHICLE_PREVIEW.md).
