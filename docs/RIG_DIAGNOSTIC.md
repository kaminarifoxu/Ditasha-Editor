# Diagnosis ekspor Full ped

Paket ini memakai engine Blender/Muto/Sollumz yang sudah terpasang melalui DITASHA. Tidak memasang engine baru dan tidak mengunggah model atau log secara otomatis.

1. Ekstrak seluruh ZIP ke folder baru.
2. Klik dua kali `Run-Rig-Diagnostic.cmd`, lalu pilih GLB yang gagal. Model juga dapat diseret ke file CMD tersebut.
3. Tunggu proses selesai. Folder hasil akan terbuka. Kirim `diagnostic-log.txt` untuk pemeriksaan lanjutan.

Log membedakan tahap hierarki, tekstur, LOD, penulisan native, dan pembuatan resource. Sebelum masuk ekspor, hasil rig disimpan dalam `ditasha-result.blend`. Proyek ini tersedia untuk koreksi jika ekspor gagal; keberadaannya tidak menandakan resource game sudah berhasil dibuat. File sumber tidak ditimpa.

Folder hasil berada di `%LOCALAPPDATA%\DITASHA-Rig-Diagnostic`. Paket ini belum merupakan perbaikan untuk penyebab keluarnya exporter native secara mendadak. Hasil pengujian harus diperiksa untuk menentukan perbaikannya.
