# Tender Zekindo

## Keputusan

Halaman pertama setelah login adalah **Tender List**. Tim langsung melihat paket tender dan deadline berikutnya, lalu bisa membuka detail dari baris yang sama. Tender List juga menjadi tujuan utama di navigasi. Analytics tetap bisa dibuka saat pengguna perlu membandingkan periode atau outcome.

## Layar pertama

Judul **Tender register** berada di atas satu area kerja yang menyatukan pencarian, filter, dan hasil. Untuk admin, **New tender** berada di sisi kanan judul. Aksi **Export** mengikuti cakupan filter yang sedang aktif.

Navigasi desktop berada dalam sidebar kiri. Grup Workspace memuat tugas harian dan Administration memuat pengelolaan khusus admin. Pada HP, tombol navigasi di samping logo membuka menu samping. Sidebar desktop dapat disembunyikan agar matriks jadwal memperoleh lebih banyak ruang.

```text
Tender register                                         + New tender
78 of 270 tenders · Next deadline first
All tenders     Upstream     Downstream
All results / Active / Won     Search · Filters · Schedule matrix · Columns · Export

Next milestone       Package                    Customer           Status     Bid value
NOV 21 Registration  Pengadaan demulsifier      PT Contoh Energi   Running    Rp …
       Today         TN-001
```

Tampilan awal membuka tender aktif dari semua track. Urutan awal mengikuti deadline terdekat, dihitung dengan tanggal Jakarta (WIB). Tender aktif tanpa jadwal tetap tersedia di bagian akhir dengan label **No upcoming milestone**. Tender selesai bisa dilihat melalui filter status. Tanggal lampau tetap terlihat pada riwayat jadwal di Detail.

Pada lebar 390 px, baris paket memakai dua tingkat. Nama paket dan status di atas, lalu milestone dan tanggal di bawah. Nama customer tetap terlihat sebelum informasi sekunder seperti nomor tender. Pencarian tetap di atas daftar. Filter lanjutan dibuka dari satu tombol.

## Baris tender

Baris tender menjadi pola yang dipakai ulang. Nama paket adalah tautan ke detail. Nomor tender muncul di bawah nama paket pada desktop. Customer memiliki kolom tersendiri. Milestone dan tanggal membentuk satu unit, sehingga pengguna bisa langsung membaca *apa yang jatuh tempo dan kapan*. **Hari ini**, **Besok**, dan **No upcoming milestone** ditulis sebagai teks. Tanggal penuh tetap tersedia ketika format singkat bisa menimbulkan ambiguitas. Gunakan angka tabular dan pertahankan perataan tanggal pada desktop.

Di Detail, tampilkan identitas paket dan status, lalu jadwal. Letakkan **Edit milestones** di dekat judul jadwal untuk admin. Saat pengguna kembali ke daftar, pertahankan pencarian, filter, dan urutannya.

## Sistem komponen

Komponen shadcn/ui New York disimpan di `src/components/ui`. Token warna, radius, dan fokus ada di `src/app/theme.css`. Gunakan Geist Sans, ikon Lucide, tombol primary untuk aksi utama, serta outline atau ghost untuk aksi pendamping. Dialog berbasis Radix mengelola fokus. Native Select memakai kontrol pilihan sistem pada HP. ChartContainer membungkus grafik Recharts.

## Arah visual

Gunakan dasar putih dan abu-abu dingin, teks slate, serta garis horizontal tipis untuk memisahkan baris. Biru Zekindo menandai aksi utama, pilihan aktif, dan fokus keyboard. Status selalu disertai label teks. Biarkan tabel memakai lebar ruang kerja. Prioritas visual ada pada judul paket dan tanggal, dengan ukuran huruf dan jarak yang konsisten.

Layar pertama langsung menampilkan hasil kerja. Kalender mini, ringkasan KPI, dan grafik punya tempat saat pengguna sengaja membuka halaman yang membutuhkannya.

## Pemeriksaan sebelum implementasi disetujui

- Pada 1440 px dan 390 px, buka halaman pertama dan temukan paket, milestone, serta deadline terdekat tanpa berpindah halaman.
- Buka paket dari daftar, temukan tindakan edit milestone sebagai admin, lalu kembali ke daftar dengan konteks yang sama.
- Periksa kasus deadline hari ini, tender tanpa jadwal, nama paket panjang, serta tampilan pengguna viewer.


## Prioritas deadline dan laporan

Ringkasan operasional berada di atas register. Keempat kartu menyaring tender aktif, deadline hari ini sampai H+3, H+4 sampai H+14, dan paket tanpa jadwal mendatang. Angka mengikuti track, pencarian, periode, area, entitas, dan customer. Memilih kartu juga memperbarui URL, hasil ekspor, dan tautan kembali dari detail. Tabel awal memuat 25 paket per halaman.

Analytics membuka laporan Performance. Batang per periode membandingkan jumlah outcome terhadap skala yang sama. Laporan Segment comparisons memuat rincian track, area, entitas, customer, dan alasan kekalahan.
