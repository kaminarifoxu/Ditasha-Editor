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
kemudian memastikan launcher selesai dan direktori ekstraksi dibersihkan.

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
