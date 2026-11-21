# Audit alur kerja tender

Audit dilakukan dengan build produksi lokal, akun admin uji, dan Chromium. Dua ukuran utama adalah 1440 × 960 dan 390 × 844 piksel. Fokus desain adalah mengenali paket yang sedang dibuka, menemukan jadwal berikutnya, mengubah data, dan kembali ke daftar semula.

| Langkah | Temuan dan hasil |
| --- | --- |
| Masuk dan pilih paket | Register memuat Schedule Matrix. Sebelumnya, tautan detail menonaktifkan prefetch. Sekarang fokus pada nama paket atau pointer yang berhenti di satu baris mempersiapkan detail paket itu. |
| Baca detail | Di HP, milestone berikutnya sebelumnya berbagi ruang dengan status dan track. Sekarang tanggal dan nama milestone mendapat satu baris penuh. Tanggal lampau memakai warna netral. [Sebelum](before-detail-390.png) · [Sesudah](after-detail-390.png) |
| Edit dari desktop | Sebelumnya, Archive tampil merah di kepala halaman dan identitas paket hanya berupa referensi. Sekarang judul paket, referensi, dan track terlihat bersama. Empat bagian dapat dibuka langsung, dan Save changes berada di atas form. [Sebelum](before-edit-1440.png) · [Sesudah](after-edit-1440.png) |
| Edit dari HP | Field disusun satu kolom. Navigasi bagian menjadi dua kolom, input memakai teks 16 px, dan tombol edit memiliki target minimum 44 px. Archive berada setelah form dengan konfirmasi. [Sebelum](before-edit-390.png) · [Sesudah](after-edit-390.png) · [Edit jadwal](after-schedule-390.png) |
| Simpan dan kembali | Pada lebar 390 px, judul tender uji diubah dan disimpan. Detail menampilkan judul baru. Tautan kembali membuka register dengan filter track dan pencarian sebelumnya. |
| Buka dokumen dan riwayat | Kedua tab menampilkan konten masing-masing. Header identitas tetap memberikan konteks paket. |
| Tinjau halaman lain | Login, register, Analytics, Deadlines, New tender, Archive, pengelolaan pengguna, dan katalog milestone diperiksa pada kedua lebar. Tidak ada overflow horizontal pada dokumen dalam state yang diperiksa. Tabel memiliki area geser sendiri. [Seluruh tampilan desktop](desktop-overview.png) · [Seluruh tampilan HP](mobile-overview.png) |

## Waktu dari klik sampai timeline tampil

Dua build dijalankan di mesin yang sama dengan database lokal yang sama. Setiap skenario membuka lima paket berbeda. Waktu dimulai saat klik dipicu dan diakhiri saat judul timeline hadir pada frame browser. Skenario fokus memberi tautan waktu 350 ms sebelum klik. Tidak ada simulasi latensi jaringan.

| Skenario | Median sebelumnya | Median sesudah |
| --- | ---: | ---: |
| Klik langsung | 74 ms | 65 ms |
| Klik setelah tautan mendapat fokus | 62 ms | 28 ms |

Detail sekarang mengambil nama pembuat dan penyunting dalam kueri tender yang sama. Ketersediaan jaringan, waktu autentikasi, lokasi database, dan perangkat pengguna dapat memengaruhi hasil di produksi.

## Pemeriksaan desain dan interaksi

- **Hierarki dan identitas**. Aksen biru dipakai untuk bagian terpilih dan penyimpanan. Nama paket memberi konteks untuk keempat bagian. Dialog konfirmasi melindungi aksi Archive.
- **Layout**. Editor memiliki navigasi samping di desktop dan navigasi dua kolom pada HP. Screenshot memperlihatkan bentuk nyata pada kedua ukuran. Uji regresi juga memeriksa lebar 320 dan 768 px.
- **Interaksi**. Pengujian mencakup fokus keyboard saat membuka paket, simpan ke database lokal, validasi, kesalahan simpan, dan kembali ke register. Tidak ada animasi baru dalam editor.
- **Batas pemeriksaan**. Screenshot halaman lain mencakup keadaan yang ditampilkan. Audit ini tidak mengesahkan semua kombinasi data, rasio kontras seluruh aplikasi, Safari iOS, pembaca layar, maupun waktu respons deployment.
