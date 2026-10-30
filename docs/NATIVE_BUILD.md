# Native game build — 1.20.0

Auto Rig memakai workspace sendiri; Debadge/Strobo ditampilkan langsung di Vehicle Workshop tanpa modal. Blender tetap berjalan sebagai proses lokal terpisah. Ini jalur baru untuk aset game; Vehicle workshop/Livery studio tetap dapat digunakan tanpa Blender. Tidak ada layanan AI, API key, atau pengunggahan model.

## Setup otomatis (Windows x64)

1. Buka **Auto rig ped → Download & set up**. Siapkan internet dan ruang kosong sekitar 3 GB. Download utama sekitar 410 MB, ditambah dependency Python/native.
2. DITASHA mengunduh Blender portable 5.2.2 LTS, Sollumz 2.9.0, dan Muto Ped Rig 0.3.2 dari rilis resmi. Arsip diperiksa dengan SHA-256; dependency szio/PyMateria dipasang oleh installer Sollumz dengan versi dan hash yang dipatok add-on tersebut.
3. Tunggu status engine terpasang. Download menampilkan progres; ekstraksi dan pemasangan memiliki log. Tombol Batalkan menghentikan setup. Coba ulang bila jaringan terputus; arsip yang selesai dan terverifikasi digunakan kembali.
4. Pilih model, isi nama ped, klik **Buat preview rig**, periksa model 3D, lalu **Simpan hasil ped** dan pilih folder tujuan. **Periksa engine & add-on** menampilkan status Sollumz, native provider dan Muto.

Engine disimpan di profil DITASHA, bukan direktori sementara EXE portable. Konfigurasi Blender pribadi tidak diubah. Build berikutnya memakai profil terpisah ini dan berjalan offline. Kode/aset add-on dan PyMateria tidak dibundel ke EXE; pengguna mengunduhnya langsung dari penyedia saat setup. PyMateria tetap memakai [lisensi penyedianya](https://static.cfx.re/PyMateria-License-Agreement.pdf).

Pilihan manual **Pilih blender.exe** tetap tersedia untuk instalasi Blender dengan Sollumz dan Muto yang sudah diaktifkan. Memilih executable manual kembali memakai preferences Blender tersebut.

## Auto rig ped

- Pilih GLB, FBX atau OBJ humanoid berdiri dalam A/T-pose, lalu nama ped 3–32 karakter (`a-z`, angka, underscore; diawali huruf).
- Klik **Buat preview rig**. Hasil ditulis ke direktori staging sementara; preview 3D muncul sebelum resource disimpan ke folder tujuan. Klik **Simpan hasil ped** dan pilih folder tujuan, atau **Buang hasil sementara**. Membatalkan dialog simpan mempertahankan preview untuk dicoba lagi. Muto menjalankan orientasi/skala, auto markers, fit skeleton, weight transfer, konversi pose GTA, validasi dan ekspor resource addon.
- Proses dapat mengganti rig dan shape keys pada salinan model yang diimpor. Input asli tidak disimpan ulang. Model dengan anatomi sulit, senjata/prop, tangan menempel tubuh atau tanpa UV memerlukan koreksi marker/weights/material di `.blend` hasil.
- DITASHA hanya melaporkan sukses bila Muto melaporkan seluruh tahap berhasil dan terdapat YFT, YDD, YTD, YMT serta fxmanifest. Simpan `batch_report.json` dan `.blend` untuk pemeriksaan. Ini tidak menjamin animasi setiap model sudah sempurna.

## Debadge native

- Pilih YFT dasar; pasangan `_hi.yft` dan YTD berada di folder yang sama.
- Klik **Analisis badge**. Kandidat berasal dari nama mesh/material/shader yang memuat badge/emblem, bukan deteksi visual AI.
- Analisis juga memuat preview 3D dari objek native yang sama. Klik badge untuk memilih kandidat, atau centang daftarnya. Face badge yang dipilih berwarna merah; **Lihat tanpa badge** menyembunyikannya pada preview. Preview menampilkan satu LOD tertinggi yang utuh, sedangkan build tetap memproses semua LOD.
- Periksa jumlah face dan centang kandidat yang benar, lalu **Build native**. Face badge dihapus pada semua mesh LOD yang terkait. UV/material face lain dipertahankan; datablock yang dibagi dengan objek lain disalin sebelum diubah.
- Seluruh target diekspor ulang melalui Sollumz. Berbeda dengan masking index pada Vehicle workshop, ini penghapusan face lewat engine pemodelan. Ekspor ulang dapat menormalisasi struktur/fitur file yang didukung Sollumz; bukan jaminan byte-identik dengan original.
- Jika nama badge tidak dapat dikenali, gunakan pemilihan manual Vehicle workshop atau edit di Blender.

## Strobo native dari donor

Versi ini memindahkan **mesh lampu rigid dan bone siren1–20 dari donor**; tidak membuat kit universal dari tombol lightbar preview.

1. Pilih YFT target dan YFT donor, keduanya beserta `_hi.yft` di folder masing-masing.
2. Lampu donor harus terikat ke bone siren melalui constraint rigid dan memakai tekstur embedded. Donor skinned, tekstur eksternal yang belum di-embed, target dengan bone siren bernama sama, atau konflik tag bone ditolak.
3. Pilih `carcols.meta` donor dan `carvariations.meta` serta `vehicles.meta` milik target. Metadata harus UTF-8, tanpa DTD/entity. Nama model harus cocok dengan nama YFT target.
4. Klik **Muat preview 3D** setelah memilih target dan donor. Preview memuat geometri siren donor yang benar, bukan lightbar contoh. Klik **Letakkan strobo** lalu permukaan kendaraan untuk menempatkan pusat lampu; geser sumbu gizmo untuk mengatur posisi. Nilai offset dan scale di bawah preview langsung terhubung ke build. Model `_hi` dan YTD mengikuti impor Sollumz; material yang tidak tersedia tetap tampil sebagai warna netral.
5. Atur offset X kanan/Y depan/Z atas dalam meter dan scale, ID donor (0 untuk setting tunggal), serta ID siren baru 1–254. ID baru harus unik di server; DITASHA tidak dapat memeriksa seluruh resource server dari komputer lokal.
6. Build menyalin bone/tag/flags dan mesh lampu, mengarahkan binding ke skeleton target, mengekspor YFT native, serta membuat patch resource dengan carcols/carvariations/vehicles dan fxmanifest. Variasi target mempertahankan kit/warna; kelas disetel emergency dan audio POLICE.

**Resource asli kendaraan tetap harus dimuat lebih dahulu** untuk tekstur/handling/aset yang tidak diganti. Housing lightbar, collision donor, kaca shattermap, part non-siren, dan rig skinned tidak dipindah otomatis. Tidak semua kendaraan donor mengikuti konvensi yang didukung; penolakan kompatibilitas harus ditangani di Blender. Uji mesh, posisi lampu, pola strobo, LOD, bone dan collision pada server uji.

## Penyimpanan, pembatalan, pengujian

Hasil ditulis ke subfolder baru `ditasha-build-*` pada folder pilihan. File input tidak ditimpa. `report.json` menentukan keberhasilan setelah proses Blender berakhir; log dibatasi dan job dijalankan satu per satu dengan timeout 15 menit. Batalkan build atau menutup aplikasi menghentikan proses Blender; hasil parsial tidak boleh dianggap sukses.

Validasi pengembangan:

- Blender **5.2.1 LTS**, Muto commit `3352c91658ebe244d5eeb9f9b98698f1ebad5c99`: humanoid uji 8.222 vertex melewati marker, fit, weights, GTA rest dan validate; skeleton 128 bone, maksimal empat pengaruh/vertex.
- Blender **4.2.0**, Sollumz commit `2cae10b4f14eb0ed2aea92bfd7d8a83fb4c8f769`: penghapusan face badge selektif dan transfer bone/binding siren diuji pada fixture geometri; konflik siren ditolak.
- Metadata/ID siren, penolakan XML entity, batas parameter job, argv tanpa shell, serta UI pemilihan kandidat/token input diuji otomatis.
- **Ekspor biner memakai PyMateria dan perilaku dalam GTA/FiveM belum diuji end-to-end pada kendaraan/ped pengguna.** Lingkungan pengembangan Linux tidak menyediakan provider native Windows. Probe/build menolak provider yang hilang. Jangan menyamakan tes kernel rigging/geometri dengan sertifikasi semua hasil di game.

Referensi: [Muto Ped Rig](https://github.com/B7Kompirine/muto-ped-rig), [Sollumz](https://github.com/Sollumz/Sollumz), [Cfx data files](https://docs.fivem.net/docs/game-references/data-files/). Hak dan lisensi proyek eksternal tetap milik masing-masing pembuat. Bridge DITASHA tidak menyalin implementasi add-on tersebut.

## Batas preview dan tekstur

Preview engine memerlukan Blender/Sollumz/provider native yang sama dengan build. Preview dibatasi 250.000 triangle, 32 thumbnail tekstur maksimal 512px dan JSON 48 MB. Batas ini hanya berlaku untuk preview; berkas sumber dan kualitas build tidak diperkecil. Posisi preview menggunakan konversi GTA Z-up ke Three Y-up; offset build tetap X kanan/Y depan/Z atas. Gizmo berada di pusat lampu donor, bukan titik origin kendaraan donor. Tidak ada animasi strobo atau simulasi collision di preview.

Pada Model viewer/Vehicle workshop, tekstur embedded tidak lagi diambil dari drawable extra lain. Jika beberapa YTD memiliki nama tekstur sama, dictionary yang namanya cocok dengan model diprioritaskan; pilihan yang ambigu tidak ditebak. Periksa **Material & livery** untuk nama binding, pilih tekstur/UV secara manual bila perlu. **Alpha** dapat disetel ke Opaque untuk body/paint atau Transparan untuk kaca/decal, serta U/V dibalik per mesh. Ini pengaturan preview, bukan penulisan ulang shader YFT. Shared texture dictionaries bawaan GTA belum dimuat otomatis; sertakan YTD yang dibutuhkan.

Smoke test geometri Blender tersedia di `scripts/smoke-native-preview.py`. Jalankan memakai Blender dengan Sollumz aktif: `blender --background --disable-autoexec --python-exit-code 2 --python scripts/smoke-native-preview.py`. Fixture memeriksa face badge selektif, thumbnail PNG, posisi geometri donor dibanding transform native dan penolakan konflik bone; tidak menggantikan pengujian ekspor biner/game.

## Ped reference, quality and pose review (v1.28)

Referensi weights: Auto, Laki-laki (mp_m), atau Perempuan (mp_f). Semua memakai skeleton humanoid GTA; `rig=mp_m` pada batch Muto bukan pembatas referensi tubuh menjadi laki-laki. Tinggi 0 mempertahankan ukuran yang dinormalisasi engine; tinggi khusus 0,5–3 meter. Opsi jari/wajah mengatur detail weights; template tangan/wajah mengikuti detail terkait. Rambut/topi dapat diarahkan ke kepala. LOD tetap dihasilkan otomatis.

Sesudah build, baca laporan weights/UV/material/LOD, lalu pilih Pose awal, Uji lengan dan Uji kaki jika tersedia. Ini pose statis hasil evaluasi modifier Blender untuk memeriksa deformasi. Pose gagal tidak dimasukkan sebagai preview valid. Save menunggu preview terpilih selesai dimuat. Bone dan pose asli dipulihkan setelah evaluasi; file game tidak diekspor ulang dari pose uji.

Tombol **Salin .blend untuk koreksi** tersedia ketika engine berhasil menyimpan proyek, termasuk pada beberapa kegagalan rig. Dialog ini hanya menyalin proyek koreksi. Simpan hasil ped tetap menjadi aksi terpisah setelah preview berhasil. Sesudah mengedit marker/weights/material/LOD di Blender, ekspor ulang dari Blender untuk memperbarui game resource. Skeleton bayi/kustom dan facial behavior tetap memerlukan referensi serta pemeriksaan yang sesuai, bukan sekadar mengganti label preset.

## Periksa sumber sebelum rig

Tombol **Periksa & preview model sumber** memakai importer GLB/FBX/OBJ Blender tanpa Muto/provider native, lalu membuat laporan UV, gambar base color, geometri, ukuran dan transform. Tidak menjalankan rig atau ekspor game. Source preview tidak memiliki stagedId/reviewId dan tidak dapat disimpan sebagai hasil ped. Shader kompleks disederhanakan; ukuran memakai unit scene dan A/T-pose perlu diperiksa visual. File input tidak ditulis ulang. Pergantian sumber membatalkan token/report lama; hasil rig yang belum disimpan mengunci pergantian sumber.
