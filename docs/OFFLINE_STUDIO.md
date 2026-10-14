# Offline studio — 1.14.0

Semua fitur pada halaman ini bekerja lokal, tanpa API key dan tanpa mengunggah model/tekstur. Referensi video digunakan untuk alur kerja; tidak ada aset atau kode milik pembuat video yang disertakan.

## Livery studio

1. Di **Texture & Model**, buka model dan YTD/PNG atlas tujuan. Pilih diffuse/livery yang benar dan aktifkan penerapan tekstur ke model.
2. Klik **Livery studio** di toolbar model. Pilih Left, Right, Front, Back, Top atau Window.
3. Pilih pola stripe, checker, chevron atau teks, atau impor PNG transparan. Drag desain atau ubah X/Y, ukuran, rotasi dan opacity. Setiap slot menyimpan pengaturan sendiri.
4. Atur **Area slot pada atlas UV** dalam persen. Buka **Posisi di atlas UV** untuk melihat rectangle aktif di atas tekstur. Pembagian awal adalah grid contoh, bukan UV kendaraan yang terdeteksi otomatis. Kendaraan FiveM berbeda dengan template ER:LC di video; gunakan template model sendiri. Tidak ada pemetaan otomatis lengkungan atau UV island.
5. **Terapkan ke layer 2D & 3D** membuat satu layer gabungan; perubahan selanjutnya mengganti layer yang sama, tanpa menumpuk duplikat. Tutup studio untuk memeriksa model, lalu simpan YTD dari editor. Undo/Redo editor tetap tersedia.
6. Ekspor **slot PNG (ZIP)** menghasilkan satu PNG per slot aktif dan `slot-mapping.json`. Simpan/buka proyek JSON untuk melanjutkan desain termasuk PNG asli, transform dan area slot. PNG dibatasi 4 megapixel/16 MB; file proyek 40 MB. PNG slot 512, 1024 atau 2048 piksel.

Slot berbentuk rectangle dan bisa tumpang tindih; urutan daftar menentukan pelapisan. Ini editor gambar lokal, bukan generator AI. Proyek livery terpisah dari YTD; simpan proyek jika ingin menyimpan semua pengaturan slot.

## Vehicle workshop

Di **Model viewer**, impor YFT/YDD/YDR kendaraan beserta YTD, lalu buka **Vehicle workshop · offline**.

- Pilih mesh dari dropdown atau **Pilih mesh di 3D**. Posisi, rotasi dan scale berlaku pada mesh yang dipilih. **Reset transform** memulihkan transform awal mesh.
- **Cari kandidat badge** mencari nama material yang memuat badge/emblem/decal/logo/script. Ini saran berdasarkan nama, bukan deteksi semantik. Periksa mesh di Visible parts lalu matikan hanya bagian yang diperlukan.
- Tambahkan extra dari file YFT/YDD/YDR milik sendiri memakai tombol **Extra** yang sudah tersedia; pilih visible dan atur transform. Aplikasi tidak menyertakan pustaka part GTA.
- **Tambah lightbar preview** membuat geometri lampu sederhana di atas bounding box kendaraan. Sesuaikan posisi, ukuran, rotasi dan warna merah/biru. Lightbar bersifat statis: belum ada animasi lampu, siren bones atau pengaturan carcols.
- **Ekspor scene GLB** menyimpan mesh yang terlihat, tekstur, transform part dan lightbar untuk preview/lanjutan di Blender. Helper vertex/grid tidak disertakan. GLB bukan file mod GTA.
- **Simpan proyek kendaraan** menyimpan transform mesh, visibilitas mesh pada drawable/LOD aktif, dan lightbar. Untuk membukanya kembali, impor file utama, extra, drawable dan LOD yang sama. Proyek mengacu pada nama, ukuran file dan key mesh; tidak menyertakan model atau YTD. Proyek tidak menyimpan binding material manual, visibilitas extra atau seluruh pengaturan setiap LOD.

### Ekspor native visual

**Ekspor resource · mesh tersembunyi** membaca ulang file asli dan mengubah index triangle milik mesh utama yang dimatikan menjadi triangle degenerate. Header resource, vertex, shader, bone, collision, pointer dan blok physics dipertahankan. Struktur hasil dibaca kembali sebelum ditawarkan sebagai unduhan. File asli tidak ditimpa; output memakai suffix `-masked`.

- Operasi ini menyembunyikan geometri visual, bukan menghapus struktur mesh atau collider. Bayangan/physics game dapat tetap mengikuti data asli.
- Setiap drawable dan LOD memakai key terpisah. Jika bagian juga ada di LOD lain, periksa dan sembunyikan di sana sebelum ekspor. Tidak ada deteksi pasangan LOD otomatis. File `_hi.yft` dan `.yft` diproses terpisah.
- Mesh yang berbagi index buffer harus dimatikan bersama; ekspor ditolak apabila hanya sebagian yang dipilih. Ini mencegah mesh yang tetap terlihat ikut rusak.
- Export native belum memasukkan transform mesh, part tambahan, lightbar, modkit, skeleton baru, `carcols.meta` atau konfigurasi siren. Perubahan tersebut hanya masuk GLB/proyek.
- Dukungan adalah GTA V Legacy RSC7 yang dapat dibaca aplikasi. Cadangkan original dan uji hasil di lingkungan game sendiri; pengujian otomatis memastikan round trip resource, bukan kompatibilitas semua kendaraan/game.

## GPU dan respons aplikasi

**GPU · Seimbang** di header membuka pengaturan Hemat (30 FPS), Seimbang (60 FPS), Detail (60 FPS), dan diagnostik renderer. Kualitas preview diingat di perangkat. Resolusi rendering dibatasi menurut profil dan DPI layar; tekstur asli serta ekspor tetap pada resolusinya. Preview berhenti menggambar ketika tidak berubah atau workspace tersembunyi. Kamera damping tetap diperbarui saat diperlukan.

WebGL meminta GPU performa tinggi; driver/sistem menentukan GPU sebenarnya. Pada laptop dual GPU gunakan Windows Settings → System → Display → Graphics untuk memilih GPU DITASHA-Editor. GPU terintegrasi tetap bisa bekerja bila WebGL tersedia. Tidak memaksa bypass blacklist driver dan tidak menjanjikan bebas lag.

Pembacaan model/YTD dan ekspor masking native berjalan dalam worker terpisah dengan antrean satu job dan timeout 45 detik. Decode tetap memakai CPU, sementara rasterisasi preview memakai GPU. Pembatasan ukuran resource/texture/vertex tetap berlaku. Bila konteks WebGL hilang, editor memberi notifikasi dan mencoba melanjutkan setelah driver memulihkan konteks; perubahan CPU tidak sengaja dibuang. Simpan proyek/YTD secara berkala karena crash proses atau driver tidak dapat selalu dipulihkan.

## Belum termasuk

Generator AI gambar→ped dan teks→livery; rigging/skin weighting; pemasangan siren atau part baru langsung ke YFT; generator modkit/game-ready carcols; template UV otomatis untuk setiap kendaraan. Pilihan pengguna pada versi ini adalah fitur offline dahulu.
