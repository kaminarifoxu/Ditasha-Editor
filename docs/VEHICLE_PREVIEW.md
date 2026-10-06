# Vehicle preview and PNG stickers

## Kendaraan, extra dan livery

Buka YFT utama beserta YTD-nya. Beberapa model bisa dipilih sekaligus; file `_hi`, `csign`, dan `livery` tidak diprioritaskan sebagai model utama. File tambahan dimasukkan ke daftar Extra dalam keadaan nonaktif agar varian tidak menumpuk. Bisa juga gunakan **Tambah extra / livery YFT**, lalu centang drawable yang ingin dilihat dan hapus yang tidak digunakan.

**Visible parts → Mesh / extra** menampilkan setiap mesh, termasuk model dengan ratusan mesh dalam satu Part. Pilihan visibility dipertahankan saat tekstur dimuat ulang. **Material & livery** menyediakan pemilihan mesh, tekstur dan UV 1/UV 2; UV 2 aktif hanya jika tersedia pada geometri. Tekstur otomatis mengikuti nama diffuse pada shader. Pemilihan manual mengganti diffuse preview mesh tersebut; belum meniru seluruh shader vehicle-paint GTA (warna cat, blending livery, refleksi, kaca, kerusakan atau animasi).

YFT physics child drawables pristine/damaged dapat diperiksa sebagai pilihan Drawable terpisah dengan shader parent sebagai fallback. Child yang tidak dapat dibaca dilaporkan sebagai warning; tidak ditumpuk otomatis atau disimulasikan sebagai rangka kendaraan. Extra YFT dari file terpisah memakai koordinat mesh yang tersimpan. Sesuaikan lewat Posisi / rotasi (X/Y/Z, rotasi dan skala) bila perlu; pemasangan bone otomatis untuk kendaraan tertentu belum tersedia. Resource terenkripsi dan GTA V Enhanced belum didukung. Gunakan model/tekstur asli untuk mengecek kecocokan kendaraan tertentu.

## Error format YTD 1c

`1c` heksadesimal adalah format Direct3D 9 `A8` (28): kanal alpha 8 bit. Decoder sekarang menghasilkan RGB putih dengan alpha asli, menghormati row stride dan batas buffer. Format L8, A8L8 dan XRGB juga didukung. Tekstur A8 tidak berarti livery berwarna; biasanya mask. Pembacaan dictionary tetap dibatasi ukuran decoded dan resource.

## PNG pada 3D

Pada **Texture & Model**, klik **PNG 3D**, pilih PNG lalu klik permukaan model. Stiker diproyeksikan ke mesh menggunakan geometri 3D, sehingga tidak bergantung pada sambungan UV kanvas 2D. Atur ukuran, rotasi dan opacity di **PNG di permukaan 3D**. Pilih stiker dalam daftar, hapus satu atau semuanya; klik **Tempatkan PNG** untuk menambah salinan. Esc membatalkan penempatan. Rotasi kamera tetap bekerja setelah penempatan.

PNG langsung diproyeksikan mengikuti UV model ke layer transparan di kanvas 2D setelah ditempatkan. Tarik tattoo terpilih, atau klik **Pindahkan tattoo** lalu klik permukaan baru. Ukuran/rotasi/opacity menyinkronkan setelah kontrol selesai diubah. **Sinkronkan ke tekstur** tersedia untuk menerapkan ulang secara manual. Sambungan UV yang terpisah tetap menerima bagian gambar yang sesuai. Hasil bisa di-Undo/Redo dan ikut ekspor YTD; kontrol tattoo tetap tersedia setelah penerapan, sehingga pemindahan memperbarui layer yang sama. **Hapus stiker** juga menghapus layer tattoo pada tekstur aktif; **Hapus semua** membersihkan kontrol preview sambil mempertahankan layer yang sudah diterapkan. Pilih tekstur tujuan yang sesuai sebelum menerapkan. **Edit 3D** memperbesar area model sambil menampilkan kanvas 2D; **Edit 2D** mengembalikan layout kanvas utama. Tattoo yang sudah terikat ke satu tekstur harus diedit pada tekstur tersebut. UV bertumpuk dapat menampilkan gambar di beberapa bagian model karena bagian tersebut memakai piksel yang sama. Berpindah model/drawable membersihkan stiker yang belum diterapkan. Maksimal 16 stiker, 16 MP per PNG, 32 MP total gambar dan 20 MB per file. Model dengan kulit/pose dianimasikan belum didukung oleh preview.

## References and validation

- Microsoft [D3DFORMAT](https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dformat): A8/L8/A8L8/XRGB channel definitions.
- CodeWalker [Frag.cs](https://github.com/dexyfex/CodeWalker/blob/master/CodeWalker.Core/GameFiles/Resources/Frag.cs) and [Drawable.cs](https://github.com/dexyfex/CodeWalker/blob/master/CodeWalker.Core/GameFiles/Resources/Drawable.cs): Legacy resource structure layouts and shader references; inspected as format references.
- Three.js bundled `DecalGeometry` provides the surface projection.

Tests use synthetic valid resources for A8 padded rows, truncation, secondary diffuse sampler, UV2 and physics child inheritance. Native renderer checks cover importing/removing extra YFTs, material assignment, invalid import retention, actual decal pixels, unchanged 2D data, and decal inclusion in Photoshoot. User vehicle packs have not been supplied, so compatibility with a specific pack still requires its original YFT/YTD files.

Rigid parts memakai transform bone hierarkis. Preview ini belum mendukung pose/animasi skinning atau semua transform physics fragment. Untuk memverifikasi kendaraan tertentu yang tetap rusak, sertakan YFT beserta YTD-nya.

Legacy BC7 YTD (format `20374342`) kini didekode ke RGBA untuk preview/edit/ekspor. DDS BC7 FourCC juga didukung; DDS DX10 tetap belum didukung. Impor model maksimal 64 file dan total 256 MB, dengan batas 64 drawable tambahan dan 2 juta vertex gabungan.
