# Asset Compressor

Buka **Asset workshop → Asset Compressor** atau kartu di Home.

1. Pilih jenis default, lalu gunakan **Folder** untuk mengimpor resource lengkap dengan struktur aslinya. **File** dapat mengimpor banyak file sekaligus tetapi tidak membawa folder induk. Kapasitas antrean dikonfigurasi sampai 25 GB dan 50.000 file; file dirujuk dahulu, bukan semuanya dibaca ke RAM.
2. Atur maksimum resolusi per kategori: default MLO/kendaraan 2K, pakaian/ped 1K. Resolusi sumber tidak diasumsikan seragam; aspek rasio tetap dan gambar kecil tidak diperbesar. Pilih YTD, buka Pengaturan file terpilih untuk mengganti jenis, memberi batas khusus, atau **Salin YTD asli tanpa optimasi**.
3. Pilih YFT/YDD/YDR untuk melihat model sumber di panel 3D. Varian YTD dipasangkan dalam folder yang sama berdasarkan nama/collection. Kontrol model membuka pengaturan tambahan dan +Textures untuk dependensi lain. Preview model maksimal 64 MB dan YTD 256 MB. Untuk MLO, preview menampilkan YDR yang dipilih; tidak menyusun satu peta YMAP lengkap.
4. Klik **Compress ke folder baru**, lalu pilih folder induk tujuan. Aplikasi membuat `DITASHA-compressed-*` dengan struktur impor yang sama. Model/rig/config/sumber asli tidak ditimpa. File besar yang hanya disalin memakai operasi filesystem native; YTD yang dioptimalkan dikerjakan satu per satu di worker.
5. Buka hasil dan baca `.ditasha-compressor/report.json`. Status `completed` berarti semua entri selesai; `completed-with-errors` mencantumkan kegagalan. `cancelled` menunjukkan batch dihentikan dan masih dapat memiliki file pending. `processing` berarti laporan akhir belum ditulis, misalnya setelah crash; folder tersebut tidak boleh dianggap sebagai resource lengkap.

## Cakupan

Optimasi berlaku pada **eksternal YTD GTA V Legacy**: resize, DXT1 untuk gambar opaque, DXT5 untuk alpha dan mipmap. ATI1/BC4 grayscale dapat dibaca, di-resize dan dikonversi ke DXT1 opaque dengan filtering data linear. DXT bersifat lossy; periksa hasil visual sebelum dipakai. YTD di atas batas 256 MB, format yang tidak didukung, dan hasil yang tidak mengurangi ukuran disk maupun alokasi GPU akan disalin asli dengan alasan di laporan.

YDD/YFT/YDR beserta tekstur tertanam, rig, skeleton, YMAP, YTYP, YBN, metadata dan skrip **disalin byte-for-byte**. Fitur ini tidak mengurangi polygon, mengubah limit game, memperbaiki aset rusak, atau menjamin seluruh resource mempunyai dependensi lengkap. Impor folder resource lengkap dan simpan sumber aslinya.

Batas 25 GB adalah batas total antrean, bukan jaminan semua RAM/drive mampu memproses setiap YTD kompleks. Pembacaan native/resource tetap mempunyai batas sendiri; lihat alasan preserved/failed dalam laporan.

## v1.42: alokasi memori resource

Optimizer dapat memadatkan ulang graphics pages meskipun pixel DXT sudah sesuai dan tidak perlu dikompres ulang. Pointer setiap texture dipindahkan ke payload hasil dan header/page count ditulis sesuai alokasi nyata. Laporan menambahkan `graphicsAllocationBytes` (before/after) selain ukuran payload tekstur dan ukuran disk. Hasil boleh sedikit lebih besar di disk jika alokasi GPU turun; proses native memverifikasi header dan panjang dekompresi hasil tersebut. Ini berbeda dari hanya menurunkan angka peringatan pada header.

Atlas besar yang mempunyai mipmap dapat dioptimalkan dari mip yang aman untuk didekode; tidak mengalokasikan seluruh atlas raksasa ke RGBA. Atlas besar tanpa mip yang aman, format tidak didukung, payload terpotong, resource terenkripsi dan dekompresi gagal tetap dipertahankan dengan alasan jelas. Data yang sudah hilang karena resize/lossy compression tidak dapat dikembalikan tanpa sumber asli.

Optimasi tetap hanya eksternal YTD. Alokasi YDD/YFT/YDR dan tekstur embedded tidak diubah. Jika peringatan masih muncul, cocokkan nama file dalam log FiveM dengan `path`, `status`, `reason` dan alokasi dalam report; pastikan server memuat folder hasil dan tidak mempunyai resource duplikat yang membawa versi lama. `optimized` tidak berarti semua file berhasil diperkecil: periksa entri `preserved` juga.
