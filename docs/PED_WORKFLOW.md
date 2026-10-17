# Alur ped di DITASHA

## Mulai dari model

1. Buka **Asset Workshop → Auto Rig** pada aplikasi desktop.
2. Pilih model **GLB, FBX, atau OBJ** beserta teksturnya. File Sims `.package` perlu diekspor lewat alat Sims terlebih dahulu; file itu bukan input langsung Auto Rig.
3. Pilih folder tujuan dan nama ped, lalu periksa pengaturan rig sebelum memulai.

Blender, Sollumz dan Muto disiapkan melalui setup engine DITASHA. Perhatikan status unduhan/setup sebelum menjalankan rig. Model dengan proporsi ekstrem, aksesori terpisah atau geometri bermasalah tetap dapat membutuhkan koreksi manual.

## Pengaturan rig

| Kontrol                                | Fungsi                                                                                                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Referensi Auto / Laki-laki / Perempuan | Memilih referensi tubuh untuk transfer weights Muto. Ketiganya memakai skeleton humanoid GTA yang sama (`mp_m` pada API Muto), bukan impor skeleton bebas. |
| Tinggi                                 | `0` mempertahankan tinggi setelah normalisasi engine; `0.5–3` menentukan tinggi target dalam meter.                                                        |
| Detail jari / wajah                    | Meminta fitting dan transfer weights bagian tersebut.                                                                                                      |
| Template tangan / wajah                | Menggunakan template engine untuk detail terkait; kontrol membutuhkan detail jari/wajah aktif.                                                             |
| Bagian kepala                          | Mengikutsertakan penanganan bagian yang menempel pada kepala.                                                                                              |

Transfer weights memakai engine `TRANSFER` dengan voting referensi dan pembuatan LOD aktif. Hasilnya bergantung pada bentuk serta kelengkapan model sumber.

## Periksa sebelum menyimpan

Setelah proses berhasil, periksa laporan kualitas dan preview 3D:

- **Pose awal** untuk memeriksa bentuk, UV dan material.
- **Uji lengan** dan **Uji kaki** untuk melihat deformasi weights ketika tulang diputar.
- Laporan vertex tanpa bobot, lebih dari empat pengaruh tulang, bobot tidak normal/tidak valid, UV, diffuse texture dan cakupan LOD.

Pose uji adalah pose statis diagnostik yang dihitung oleh modifier armature Blender. Pose ini bukan klip animasi GTA atau pengganti pengujian di game. Pose yang tidak dapat dihitung akan menghasilkan peringatan. Pergantian pose mempertahankan kamera; tombol simpan menunggu preview berhasil dimuat. Pengujian pose tidak mengekspor ulang atau mengubah resource game yang sudah dibuat.

Gunakan **Simpan** untuk menyimpan resource hasil yang sudah diperiksa. Periksa lagi ped di GTA/FiveM, termasuk gerakan dan LOD pada jarak berbeda.

## Koreksi lewat Blender

Gunakan **Salin .blend untuk koreksi** pada laporan hasil. Pilih nama/lokasi proyek melalui dialog simpan, lalu buka salinannya di Blender dengan Sollumz/Muto yang sesuai. Salinan ini terpisah dari tindakan menyimpan resource game. Proyek yang sempat dibuat pada proses gagal juga bisa ditawarkan untuk pemulihan, tanpa menyatakan ekspor game berhasil.

Di Blender, periksa fitting/marker, weight paint, normalisasi dan batas pengaruh tulang, UV/material, color attributes, transforms, struktur Sollumz serta LOD. Setelah koreksi, **ekspor ulang melalui alur Sollumz/Muto** dan uji hasilnya di game. Mengubah atau menyalin `.blend` saja tidak memperbarui YFT/YDD/YTD/YMT yang sebelumnya diekspor. Tekstur dipack jika memungkinkan; peringatan packing berarti sebagian gambar mungkin perlu ditautkan kembali.

## Hubungan dengan tutorial

Video Eishabeesha mencantumkan tahap impor skeleton, transfer dan pengujian weights, weight painting, color attributes, transforms, Sollumz, penggabungan ped, LOD, ekspor serta pengujian server. DITASHA menyediakan pengaturan transfer, audit, pose diagnostik dan proyek koreksi untuk mendukung alur itu. Weight painting dan koreksi artistik tetap dilakukan di Blender.

Referensi dipelajari dari metadata, deskripsi dan chapter yang tersedia. Akses subtitle penuh dibatasi layanan; dokumen ini tidak mengklaim pemeriksaan setiap langkah visual kedua video.

- [Antas Digital Lab — MAKE BASE CUSTOMPED FROM SIMS4 PART 8](https://www.youtube.com/watch?v=V5geo7SLkLI&list=PL6pBHCElJJfcmJcgH-Kc6g2BbujFmHsuJ)
- [Eishabeesha — How To Make A GTA Ped In Blender](https://www.youtube.com/watch?v=thva43vZKUc&list=PL6ORxl1T4v6sp31C1lWzN8ohoCn6pZEql)
- [Muto 0.3.2](https://github.com/B7Kompirine/muto-ped-rig/tree/v0.3.2), [pengaturan](https://github.com/B7Kompirine/muto-ped-rig/blob/v0.3.2/bl/props.py), [batch worker](https://github.com/B7Kompirine/muto-ped-rig/blob/v0.3.2/bl/batch_worker.py)
