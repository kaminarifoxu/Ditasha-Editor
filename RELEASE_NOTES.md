DITASHA Editor 1.3.3

- Alur update mengikuti FiveM Cache Switcher: tekan Update sekarang untuk unduh, verifikasi SHA-256, pasang, dan mulai ulang dari aplikasi.
- Pemasangan menunggu editor dan peluncur NSIS selesai, lalu menggunakan File.Replace untuk mengganti EXE secara atomik dengan cadangan rollback.
- Helper memakai EncodedCommand; lingkungan portable lama dibersihkan sebelum versi baru dijalankan.
- Setiap unduhan memakai staging terpisah dan staging gagal dibersihkan.
- Windows CI menguji unduhan GitHub dengan jaringan Electron asli, lalu penggantian dan restart EXE portable hasil build beserta pembersihan runtime lama.

Versi lama tetap harus ditutup dan diganti manual jika updater lamanya tidak berjalan.
Copyright © 2026 Ditasha-Workshop.
