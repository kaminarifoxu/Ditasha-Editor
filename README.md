# GANOMABI Asset Studio — Windows portable

© 2026 GANOMABI / amiinarii

Untuk Windows 10/11 64-bit. Buka GANOMABI-Asset-Studio-1.0.0-Windows-x64.exe.
Tidak membutuhkan instalasi, Node.js, login, atau koneksi internet.
Editor, logo, karakter, font, dan preview 3D disertakan dalam aplikasi.

Buka YDD/YTD melalui Buka file. Tambah PNG/JPG/WebP atau tekstur YTD sebagai
layer. Gunakan 8 titik untuk resize, titik atas untuk rotate, klik kanan
untuk crop/duplikat/urutan/hide/lock/delete. Tombol + membuat workspace baru.
Ekspor PNG atau Simpan YTD membuka pilihan lokasi penyimpanan Windows.
Perubahan tetap di memori selama aplikasi terbuka; ekspor sebelum menutup.

YDD Legacy: preview geometri statis + UV; bukan editor mesh dan belum ekspor YDD.
YTD Legacy: BGRA/RGBA dan DXT1/3/5; ekspor BGRA tanpa kompresi, satu mipmap.
UV biru adalah panduan dan tidak masuk ke ekspor tekstur.
Akselerasi grafis diperlukan untuk preview 3D. GLB juga didukung.

Build dari kode sumber:
1. Pasang Node.js LTS di Windows.
2. Jalankan `npm ci` di folder ini.
3. Jalankan `npm run build:win`.
4. File portable ada di folder release.

Electron 44.5.1 / electron-builder 26.15.3. Kode aplikasi tidak diberi lisensi
redistribusi umum; dependensi pihak ketiga mengikuti lisensinya masing-masing.
Aplikasi belum ditandatangani dengan sertifikat penerbit.

## Update aplikasi — versi 1.1.0

Sumber update: https://github.com/kaminarifoxu/FIVEM-YDD-YTD-EDITOR/releases

Aplikasi mengecek Releases saat dibuka. Jika ada versi stabil yang lebih baru,
file EXE diunduh otomatis dengan progres dan diverifikasi SHA-256. Pengaturan
Unduh otomatis dapat dimatikan; tombol Cek update tetap tersedia di header.
Saat unduhan selesai, ekspor desainmu lalu pilih Pasang & mulai ulang.
EXE lama dicadangkan sebagai `<nama exe>.previous`, versi baru menggantinya di
lokasi yang sama. Jika penggantian file gagal, versi lama dipulihkan.

Untuk update berikutnya:
1. Ubah `version` di package.json dan package-lock.json (contoh 1.2.0).
2. Perbarui RELEASE_NOTES.md dengan maksimal empat poin perubahan utama.
3. Push ke main. Workflow Windows menguji, membuat EXE + checksum, dan
   menerbitkan GitHub Release v1.2.0 otomatis. Rilis yang sudah ada tidak ditimpa.
4. Aplikasi pengguna mendeteksi rilis setelah GitHub Actions selesai.

Jika menerbitkan rilis manual, gunakan tag vX.Y.Z dan lampirkan:
`GANOMABI-Asset-Studio-X.Y.Z-Windows-x64.exe` serta file `.exe.sha256`.
Kode di repo saja tidak menjadi update sebelum ada rilis dengan lampiran EXE.
Versi 1.0.0 belum memiliki updater; unduh dan buka 1.1.0 sekali secara manual.
Pengaturan updater disimpan internal di folder data aplikasi Windows, tidak
memerlukan file konfigurasi di samping EXE. Internet diperlukan hanya untuk update.
