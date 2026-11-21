# Audit Schedule Matrix

Pengujian memakai Chromium dengan data contoh yang sama pada lebar 1440 dan 390 px. Label status terpanjang pada contoh adalah `LOSS TECHNICAL (BOTTLE TEST)`.

| Langkah | Temuan dan hasil |
| --- | --- |
| 1. Baca status dan tanggal di desktop | Status panjang muat pada viewport awal. Setelah revisi, status memakai ruang yang dibatasi dan bisa terbaca dalam dua baris. Tanggal lampau memakai warna netral. [Sebelum](before-1440.png) · [Sesudah](after-1440.png) |
| 2. Geser matriks di HP | Pada versi awal, ujung status merah menimpa tanggal Site visit. Setelah revisi, status membungkus sebelum batas sel. Tes browser juga memeriksa posisi dropdown saat status diedit. [Sebelum](before-390.png) · [Sesudah](after-390.png) |
| 3. Cari milestone dan atur kolom | Jump to milestone memindahkan fokus ke header kolom yang dipilih. Menu Columns menyediakan pencarian, pengaturan baris ringkas, dan pemulihan kolom default untuk track saat ini. [Menu Columns](columns.png) |

Pengujian interaksi mencakup fokus keyboard setelah lompat kolom, batas label dan editor status, pencarian kolom, pemulihan default, serta pengaturan kepadatan. Perilaku pembaca layar dan Safari iOS belum diuji.
