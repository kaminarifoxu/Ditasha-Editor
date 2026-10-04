# DITASHA Editor

© 2026 Ditasha-Workshop

Editor YTD dan preview YDD GTA V Legacy untuk Windows 10/11 64-bit.
Unduh DITASHA-Editor.exe dari Releases dan buka langsung tanpa instalasi.
Logo, tema sakura, font, dan editor disertakan untuk penggunaan offline.

## Fitur

YDD: preview geometri statis, UV, wireframe dan foto 3D.
YTD: DXT1/3/5, BGRA/RGBA; ekspor BGRA tanpa kompresi, satu mipmap.
Layer gambar dan YTD: geser, resize 8 titik, rotate, crop, mirror,
opacity, kuas, penghapus, urutan, duplikat, kunci, undo/redo dan tab.
UV biru tidak ikut diekspor. Pengeditan mesh/ekspor YDD belum tersedia.
Ekspor desain sebelum menutup; proyek tersimpan di memori selama aplikasi terbuka.

## Update

Aplikasi mengecek repo kaminarifoxu/FIVEM-YDD-YTD-EDITOR dan mengunduh rilis
stabil terbaru otomatis dengan verifikasi SHA-256. Ekspor desain lalu pilih
Pasang & mulai ulang. EXE lama dicadangkan sebagai .previous.
Versi 1.1.0–1.2.1 perlu diganti manual satu kali ke DITASHA-Editor.exe.

## Build dan rilis

Jalankan npm ci, npm test, dan npm run build:win di Windows dengan Node.js LTS.
Output: release/DITASHA-Editor.exe. Naikkan version di package.json dan
package-lock.json, perbarui RELEASE_NOTES.md, lalu push ke main. GitHub
Actions membangun EXE dan checksum serta menerbitkan rilis vX.Y.Z otomatis.
Nama EXE tetap sama; versi ditentukan oleh tag rilis dan metadata aplikasi.
Untuk rilis manual sertakan DITASHA-Editor.exe dan DITASHA-Editor.exe.sha256.

Electron 44.5.1 / electron-builder 26.15.3. Kode tidak diberi lisensi
redistribusi umum; dependensi mengikuti lisensinya masing-masing.
