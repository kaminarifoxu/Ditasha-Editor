# Native game build — 1.15.0

Tombol **Game build** menjalankan Blender sebagai proses terpisah. Ini jalur baru untuk aset game; Vehicle workshop/Livery studio tetap dapat digunakan tanpa Blender. Tidak ada layanan AI, API key, atau pengunggahan model.

## Pasang engine sekali

1. Pasang Blender. Untuk rigging gunakan **Blender 5.2**; kendaraan memakai API Blender 4.2+. Pengujian menemukan template Muto saat ini memakai format .blend 5.x yang tidak terbaca oleh Blender 4.2.
2. Pasang dan aktifkan [Sollumz 2.9](https://github.com/Sollumz/Sollumz/releases) di Blender. Pasang dependency melalui panel resmi Sollumz, termasuk **szio/PyMateria** untuk native binary. Provider native ini memerlukan Windows. Ikuti lisensi/konfirmasi dari penyedia saat memasangnya.
3. Untuk ped, pasang dan aktifkan [Muto Ped Rig](https://github.com/B7Kompirine/muto-ped-rig/releases).
4. Di DITASHA pilih **Game build → Pilih blender.exe → Periksa engine & add-on**. Pilih executable Blender langsung, bukan launcher. Status probe menampilkan add-on yang aktif dan ketersediaan provider native. Probe selesai bukan berarti semua dependency sudah siap; periksa baris `native tersedia`.

Gunakan Blender dengan add-on tersebut aktif di preferences. DITASHA tidak memasang, memperbarui atau mengunduh kode add-on otomatis. Setelah setup, proses build bekerja offline. Tidak ada salinan kode/aset GPL Muto/Sollumz di EXE; keduanya dipasang terpisah dan dipanggil melalui API Blender.

## Auto rig ped

- Pilih GLB, FBX atau OBJ humanoid berdiri dalam A/T-pose, lalu nama ped 3–32 karakter (`a-z`, angka, underscore; diawali huruf).
- Pilih folder hasil, kemudian **Build native**. Muto menjalankan orientasi/skala, auto markers, fit skeleton, weight transfer, konversi pose GTA, validasi dan ekspor resource addon.
- Proses dapat mengganti rig dan shape keys pada salinan model yang diimpor. Input asli tidak disimpan ulang. Model dengan anatomi sulit, senjata/prop, tangan menempel tubuh atau tanpa UV memerlukan koreksi marker/weights/material di `.blend` hasil.
- DITASHA hanya melaporkan sukses bila Muto melaporkan seluruh tahap berhasil dan terdapat YFT, YDD, YTD, YMT serta fxmanifest. Simpan `batch_report.json` dan `.blend` untuk pemeriksaan. Ini tidak menjamin animasi setiap model sudah sempurna.

## Debadge native

- Pilih YFT dasar; pasangan `_hi.yft` dan YTD berada di folder yang sama.
- Klik **Analisis badge**. Kandidat berasal dari nama mesh/material/shader yang memuat badge/emblem, bukan deteksi visual AI.
- Periksa jumlah face dan centang kandidat yang benar, lalu **Build native**. Face badge dihapus pada semua mesh LOD yang terkait. UV/material face lain dipertahankan; datablock yang dibagi dengan objek lain disalin sebelum diubah.
- Seluruh target diekspor ulang melalui Sollumz. Berbeda dengan masking index pada Vehicle workshop, ini penghapusan face lewat engine pemodelan. Ekspor ulang dapat menormalisasi struktur/fitur file yang didukung Sollumz; bukan jaminan byte-identik dengan original.
- Jika nama badge tidak dapat dikenali, gunakan pemilihan manual Vehicle workshop atau edit di Blender.

## Strobo native dari donor

Versi ini memindahkan **mesh lampu rigid dan bone siren1–20 dari donor**; tidak membuat kit universal dari tombol lightbar preview.

1. Pilih YFT target dan YFT donor, keduanya beserta `_hi.yft` di folder masing-masing.
2. Lampu donor harus terikat ke bone siren melalui constraint rigid dan memakai tekstur embedded. Donor skinned, tekstur eksternal yang belum di-embed, target dengan bone siren bernama sama, atau konflik tag bone ditolak.
3. Pilih `carcols.meta` donor dan `carvariations.meta` serta `vehicles.meta` milik target. Metadata harus UTF-8, tanpa DTD/entity. Nama model harus cocok dengan nama YFT target.
4. Atur offset X kanan/Y depan/Z atas dalam meter dan scale, ID donor (0 untuk setting tunggal), serta ID siren baru 1–254. ID baru harus unik di server; DITASHA tidak dapat memeriksa seluruh resource server dari komputer lokal.
5. Build menyalin bone/tag/flags dan mesh lampu, mengarahkan binding ke skeleton target, mengekspor YFT native, serta membuat patch resource dengan carcols/carvariations/vehicles dan fxmanifest. Variasi target mempertahankan kit/warna; kelas disetel emergency dan audio POLICE.

**Resource asli kendaraan tetap harus dimuat lebih dahulu** untuk tekstur/handling/aset yang tidak diganti. Housing lightbar, collision donor, kaca shattermap, part non-siren, dan rig skinned tidak dipindah otomatis. Tidak semua kendaraan donor mengikuti konvensi yang didukung; penolakan kompatibilitas harus ditangani di Blender. Uji mesh, posisi lampu, pola strobo, LOD, bone dan collision pada server uji.

## Penyimpanan, pembatalan, pengujian

Hasil ditulis ke subfolder baru `ditasha-build-*` pada folder pilihan. File input tidak ditimpa. `report.json` menentukan keberhasilan setelah proses Blender berakhir; log dibatasi dan job dijalankan satu per satu dengan timeout 15 menit. Batalkan build atau menutup aplikasi menghentikan proses Blender; hasil parsial tidak boleh dianggap sukses.

Validasi pengembangan:

- Blender **5.2.1 LTS**, Muto commit `3352c91658ebe244d5eeb9f9b98698f1ebad5c99`: humanoid uji 8.222 vertex melewati marker, fit, weights, GTA rest dan validate; skeleton 128 bone, maksimal empat pengaruh/vertex.
- Blender **4.2.0**, Sollumz commit `2cae10b4f14eb0ed2aea92bfd7d8a83fb4c8f769`: penghapusan face badge selektif dan transfer bone/binding siren diuji pada fixture geometri; konflik siren ditolak.
- Metadata/ID siren, penolakan XML entity, batas parameter job, argv tanpa shell, serta UI pemilihan kandidat/token input diuji otomatis.
- **Ekspor biner memakai PyMateria dan perilaku dalam GTA/FiveM belum diuji end-to-end pada kendaraan/ped pengguna.** Lingkungan pengembangan Linux tidak menyediakan provider native Windows. Probe/build menolak provider yang hilang. Jangan menyamakan tes kernel rigging/geometri dengan sertifikasi semua hasil di game.

Referensi: [Muto Ped Rig](https://github.com/B7Kompirine/muto-ped-rig), [Sollumz](https://github.com/Sollumz/Sollumz), [Cfx data files](https://docs.fivem.net/docs/game-references/data-files/). Hak dan lisensi proyek eksternal tetap milik masing-masing pembuat. Bridge DITASHA tidak menyalin implementasi add-on tersebut.
