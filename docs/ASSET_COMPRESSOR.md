# Asset Compressor

Buka **Asset workshop → Asset Compressor** atau kartu di Home.

1. Pilih jenis default, lalu gunakan **Folder** untuk mengimpor resource lengkap dengan struktur aslinya. **File** dapat mengimpor banyak file sekaligus tetapi tidak membawa folder induk. Kapasitas antrean dikonfigurasi sampai 25 GB dan 50.000 file; file dirujuk dahulu, bukan semuanya dibaca ke RAM.
2. Atur maksimum resolusi per kategori: default MLO/kendaraan 2K, pakaian/ped 1K. Resolusi sumber tidak diasumsikan seragam; aspek rasio tetap dan gambar kecil tidak diperbesar. Pilih YTD, buka Pengaturan file terpilih untuk mengganti jenis, memberi batas khusus, atau **Salin YTD asli tanpa optimasi**.
3. Pilih YFT/YDD/YDR untuk melihat model sumber di panel 3D. Varian YTD dipasangkan dalam folder yang sama berdasarkan nama/collection. Kontrol model membuka pengaturan tambahan dan +Textures untuk dependensi lain. Preview model maksimal 64 MB dan YTD 256 MB. Untuk MLO, preview menampilkan YDR yang dipilih; tidak menyusun satu peta YMAP lengkap.
4. Klik **Compress ke folder baru**, lalu pilih folder induk tujuan. Aplikasi membuat `DITASHA-compressed-*` dengan struktur impor yang sama. Model/rig/config/sumber asli tidak ditimpa. File besar yang hanya disalin memakai operasi filesystem native; YTD yang dioptimalkan dikerjakan satu per satu di worker.
5. Buka hasil dan baca `.ditasha-compressor/report.json`. Status `completed` berarti semua entri selesai; `completed-with-errors` mencantumkan kegagalan. `cancelled` menunjukkan batch dihentikan dan masih dapat memiliki file pending. `processing` berarti laporan akhir belum ditulis, misalnya setelah crash; folder tersebut tidak boleh dianggap sebagai resource lengkap.

## Cakupan

Optimasi berlaku pada **eksternal YTD GTA V Legacy**: resize, DXT1 untuk gambar opaque, DXT5 untuk alpha dan mipmap. DXT bersifat lossy; periksa hasil visual sebelum dipakai. YTD di atas batas 256 MB, format yang tidak didukung, dan hasil yang tidak lebih kecil akan disalin asli dengan alasan di laporan.

YDD/YFT/YDR beserta tekstur tertanam, rig, skeleton, YMAP, YTYP, YBN, metadata dan skrip **disalin byte-for-byte**. Fitur ini tidak mengurangi polygon, mengubah limit game, memperbaiki aset rusak, atau menjamin seluruh resource mempunyai dependensi lengkap. Impor folder resource lengkap dan simpan sumber aslinya.

Batas 25 GB adalah batas total antrean, bukan jaminan semua RAM/drive mampu memproses setiap YTD kompleks. Pembacaan native/resource tetap mempunyai batas sendiri; lihat alasan preserved/failed dalam laporan.
