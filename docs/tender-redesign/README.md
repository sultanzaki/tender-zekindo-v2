# Redesign alur tender

## Opsi A · Antrean kerja

```text
OVERVIEW                TENDER LIST               TENDER DETAIL
[Overview]    [Tenders] [Tenders]     [+ Tender]  [Tenders / Paket]
[Track]                 [Track]                   [Paket]     [Edit milestone]
[Deadline terdekat]     [Cari | Filter | Ekspor]   [Status | Milestone | Tanggal]
[Paket | Milestone | Tgl] [Paket | Status | Tgl]    [Jadwal | Dokumen | Riwayat]
[Paket | Milestone | Tgl] [Paket | Status | Tgl]    [Jadwal]       [Nilai & konteks]
[Follow-up] [Ringkasan]  [Pagination]
```

## Opsi B · Papan operasi

```text
OVERVIEW                TENDER LIST               TENDER DETAIL
[Overview]              [Tenders]                 [Tenders / Paket]
[Hari ini] [Minggu ini]  [Cari] [Filter samping]   [Paket | Status]
[Kalender mingguan]      [Daftar paket]            [Jadwal | Dokumen | Riwayat]
[Item terpilih] [Buka]   [Aksi baris: Buka paket]  [Milestone berikutnya]
[Follow-up]              [Aksi bawah: Ekspor]      [Aksi bawah: Edit milestone]
```

**Pilihan: A.** Antrean yang sudah diurutkan menampilkan tanggal terdekat saat halaman dibuka. Pola paket, milestone, dan tanggal berlanjut dari Overview ke Tender List. Admin dapat membuka editor pada bagian Milestones dari bagian atas Tender Detail. Opsi B membantu membaca distribusi tanggal sepanjang minggu dan menempatkan tindakan edit di bawah jadwal.

Pada lebar 390 px, tanggal tetap bersebelahan dengan nama milestone di Overview dan Tender List. Aksi edit muncul setelah identitas tender dan sebelum tab jadwal di Tender Detail.

## Screenshot

Kedua versi memakai akun admin lokal, seed tender yang sama, dan tiga tanggal Registration yang disetel relatif terhadap hari pengambilan gambar. Tender List memakai filter Active di kedua versi, dan Tender Detail membuka T0001.

| Halaman | Desktop 1440 px | Mobile 390 px |
| --- | --- | --- |
| Overview | [Sebelum](before-overview-1440.png) · [Sesudah](after-overview-1440.png) | [Sebelum](before-overview-390.png) · [Sesudah](after-overview-390.png) |
| Tender List | [Sebelum](before-list-1440.png) · [Sesudah](after-list-1440.png) | [Sebelum](before-list-390.png) · [Sesudah](after-list-390.png) |
| Tender Detail | [Sebelum](before-detail-1440.png) · [Sesudah](after-detail-1440.png) | [Sebelum](before-detail-390.png) · [Sesudah](after-detail-390.png) |

- **Overview.** Agenda tujuh hari menampilkan jumlah tender per tanggal. Pilih tanggal berisi deadline untuk menuju baris terkait. Follow-up dan ringkasan pipeline membentuk kolom pendamping pada desktop.
- **Tender List.** Paket, customer, status, dan milestone berada di kolom depan. Di HP, tanggal ada di setiap tender dan filter lanjutan dapat dibuka sesuai kebutuhan. Link paket membawa filter daftar ke halaman detail.
- **Tender Detail.** Status dan tanggal muncul bersama identitas, sebelum tab Schedule, Documents, dan Activity. Tombol Edit milestones membuka bagian Milestones langsung. Link kembali mengikuti halaman asal dari Overview atau Tender List.
- **Analytics.** Cakupan tender dan periode tampil pada judul, dengan grafik win rate dan jumlah outcome sebelum ringkasan. Grafik customer menyebut ukuran sampel minimum.

## Komponen

- `OperationsHeading` menyatukan hierarki judul, konteks, dan posisi aksi pada empat halaman.
- `MilestoneDue` menyajikan label milestone, tanggal dengan angka tabular, dan penanda Today atau Tomorrow di antrean, tabel, dan detail.
- Baris antrean memakai garis aksen pada deadline terdekat. Tender Detail memakai baris ringkasan status, milestone, dan track sebagai penghubung ke jadwal.
