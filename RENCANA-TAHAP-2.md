# Rencana Tahap 2 bc.kampungsumberalam.com

Disusun 2 September 2026 untuk Nanan (Moté Kreatif). Klien Kampung Sumber Alam (KSA). Pemakai akhir staf KSA, sebagian dari HP.

## Enam tahap, dua di antaranya rem keselamatan yang harus jalan sebelum fitur baru

| Urutan | Tahap | Kenapa di posisi ini | Perkiraan kerja Mote |
|---|---|---|---|
| 1 | Daftar promo benar, kunci run, angka rupiah di layar, error batas Meta dipisah | Tanpa ini, tiap fitur baru menambah jalan menuju tagihan dobel dan tamu sehat terbuang | 2-3 hari |
| 2 | Banjir event status dipindah dari workflow CS ke database Cloudflare | Blast 12.559 nomor sekarang menyumbat balasan chat tamu. Harus beres sebelum volume naik | 2-3 hari + 24 jam tunggu status |
| 3 | Cangkang baru, sidebar di laptop, tab bawah di HP | Dibutuhkan begitu halaman lebih dari satu. Dikerjakan sekali, dipakai tiga tahap berikutnya | 1 hari |
| 4 | Buat Promo, ditinjau Nanan, lalu diajukan ke Meta | Permintaan pertama Nanan. Ditaruh setelah rem karena promo baru = volume baru | 3-4 hari + tunggu Meta |
| 5 | Daftar Tamu, unggah sendiri, kirim hanya ke daftar itu | Butuh perubahan di mesin saring n8n. Aman dikerjakan setelah kunci run dan kuota harian ada | 2-3 hari |
| 6 | Dashboard | Isinya baru berarti setelah tahap 2 menyimpan status per pesan | 2 hari |

Total perkiraan 12-16 hari kerja, tersebar sekitar 4-5 minggu kalender karena ada masa tunggu Meta dan masa tunggu status 24 jam. Angka hari adalah perkiraan, bukan janji.

Urutan ini beda dari yang Nanan bayangkan ("teks dulu, lalu database, lalu jeda, lalu kirim"). Bayangan itu benar sebagai alur staf saat *menyusun satu blast* di Blaster. Di WhatsApp resmi, alurnya terputus di tengah. Teks promo harus disetujui Meta dulu, biasanya beberapa jam sampai sehari, baru boleh dikirim. Jadi "tulis teks" dan "kirim" tidak bisa satu layar. Halaman Buat Promo dipakai beberapa hari sebelum blast, halaman Kirim Promo dipakai saat blast. Soal jeda per pesan, lihat bagian "sengaja tidak dibangun".

## Lima keputusan arsitektur yang mengikat semua tahap

### Metadata promo pindah ke database Cloudflare D1, bukan TypeScript, bukan Meta

Masalahnya sekarang, nama ramah dan masa berlaku promo tertulis di `/Users/nanansomanan/Documents/GitHub/bc-ksa/src/lib/katalog.ts`. Promo baru yang disetujui Meta tidak akan muncul di layar staf sampai ada yang mengedit kode dan push ke GitHub (`katalog.ts:119-126` memberi label "Belum diperiksa Mote", `Step1Promo.tsx:61-62` membuangnya ke daftar lama). Meta sendiri tidak menyimpan tanggal kedaluwarsa. Jadi harus ada tempat ketiga.

Pilihannya KV atau D1, dua-duanya milik Cloudflare, dua-duanya tanpa server. Dipilih D1 (database SQLite kecil) karena tahap 2 butuh penghitung yang tidak boleh salah saat ratusan event masuk bersamaan. KV bisa kehilangan hitungan kalau dua penulis menimpa nilai yang sama dalam detik yang sama. D1 punya `UPDATE ... SET n = n + 1` yang atomik. Sekalian satu tempat untuk promo, draf, run, status pesan, dan daftar tamu. KV tetap dipakai untuk sesi login, rem login, pengaturan, dan cache Meta.

Aturan tampil untuk staf. Promo muncul di Kirim Promo hanya kalau tiga syarat terpenuhi. Status Meta APPROVED. Ada baris di tabel `promo` D1. Kolom `berlaku_sampai` kosong atau belum lewat hari ini. Template yang ada di Meta tapi tidak punya baris D1 tidak muncul ke staf. Nanan melihatnya di halaman Tinjau dengan tanda "belum diberi masa berlaku". Karena Buat Promo (tahap 4) mewajibkan isian masa berlaku, kondisi "tanpa baris D1" hanya terjadi pada template yang dibuat manual di WhatsApp Manager.

Isi awal tabel `promo` untuk 17 template yang ada. Dua entri tanpa masa berlaku (`bc_for_last_year`, `new_tripad_2026`). Lima belas sisanya diberi `berlaku_sampai` di masa lalu, misalnya `romo_agustus_2026` diberi `2026-08-31`. Hasilnya, per hari ini staf hanya melihat 2 promo, persis yang Nanan minta. Menghapus 15 template dari Meta (usul devil) tidak dilakukan lewat kode. Itu keputusan Nanan dan KSA. Kalau nanti disepakati, pekerjaannya 10 menit lewat WhatsApp Manager, dan tabel D1 tinggal ikut. Catatan, nama template yang dihapus tidak bisa dipakai lagi 30 hari.

### Kunci run dibuat oleh database, bukan oleh halaman

Sekarang `functions/api/kirim.ts:22` selalu membuat run baru tanpa memeriksa run yang masih jalan. Pemulihan layar memakai `localStorage` (`Wizard.tsx:33`), jadi HP lain tidak tahu ada pengiriman yang sedang berlangsung.

Rancangan baru. Tabel `run` di D1 punya indeks unik parsial `WHERE status IN ('menyiapkan','jalan')`. Baris kedua dengan status itu ditolak database, bukan oleh logika yang bisa balapan. `/api/kirim` mencoba INSERT dulu. Gagal INSERT berarti ada run aktif, halaman menerima 409 beserta data run itu dan langsung melompat ke layar progres, dari HP mana pun.

Timeout 120 detik di `functions/_lib/n8n.ts:8` dihilangkan dari jalur kirim. Node `Balas Mulai` di workflow n8n dipindah ke depan, langsung setelah `Input Web`, membalas `{ok, runId}` dalam hitungan detik. Jumlah target dikirim n8n lewat laporan progres pertama (field baru `target`). Layar progres menampilkan "Menyiapkan daftar tamu" sampai angka target datang. Jalur hitung (DRY) tetap menunggu jawaban penuh seperti sekarang, hanya jalur LIVE yang dibalas dini. Karena pemeriksaan template (APPROVED, tanpa isian berubah-ubah) di node `Siapkan Broadcast` kini terjadi setelah balasan dini, Cloudflare mengulang pemeriksaan itu sendiri dari data promo sebelum membuat run, dan n8n yang terpaksa membatalkan setelah balasan dini wajib melapor `gagal_mulai` beserta alasannya ke `progress-callback`. Kalau dalam 5 menit tidak ada laporan pertama, run juga ditandai `gagal_mulai` dan kuncinya lepas.

Run yang mati di tengah. Kalau `diperbarui` lebih tua dari 15 menit sementara status masih `jalan`, endpoint `/api/run-aktif` menandainya `terputus` dan kunci lepas. Layar bilang "pengiriman sebelumnya terputus di X dari Y tamu, boleh mulai baru, tamu yang sudah menerima tidak akan dikirimi dua kali". Jaminan tidak dobel datang dari kolom `last_bc` di sheet yang sudah ditulis per batch oleh node `Tandai Sudah Dikirimi`, dan filter 25 hari di `Saring Nomor`.

### Event status berhenti menyentuh Google Sheets saat blast berlangsung

Sekarang delivered/read/optout diproses workflow CS `DYBEoQ4i5p6kuJ2Z` (49 node), tiap event mencari wamid di sheet `BC - Log`. Kuota Google Sheets 60 tulis per menit per user. Blast 12.559 nomor menghasilkan sekitar 37 ribu event. Balasan CS ke tamu ikut mengantre di belakangnya.

Rancangan baru, tiga potong.

1. Di workflow CS, satu node IF paling atas. Kalau payload Meta berisi `statuses`, teruskan seluruh payload dengan satu HTTP POST ke `https://bc.kampungsumberalam.com/api/status-callback` (dijaga header `X-BC-Secret`, sama seperti `progress-callback`), lalu berhenti. Tidak ada node Sheets yang tersentuh. Event `messages` (chat tamu, opt-out) tetap lewat jalur lama, tidak diubah.
2. Node `Lapor Progres` di workflow broadcast ikut mengirim daftar `[{wamid, nomor}]` per batch 50. Cloudflare menyimpannya ke tabel `pesan` D1. Saat status datang, `UPDATE pesan SET status_terakhir = ... WHERE wamid = ?`. Wamid yang tidak dikenal (chat CS biasa) tidak menghasilkan baris. Field `pricing.billable` dari payload status ikut disimpan, ini satu-satunya sinyal tagihan yang bisa dibaca token sekarang.
3. Workflow n8n baru `KSA - BC Tulis Balik`, cron 03.00 WIB. Tarik `/api/tulis-balik?sejak=` lalu perbarui `BC - Log` dan kolom `pernah_baca` / status `invalid` di `BC - Audience` secara massal, satu kali sehari. Filter "3 kali dikirimi tak pernah dibuka" dan "nomor mati" tetap bekerja, hanya datanya terlambat maksimal sehari.

Sheet `BC - Audience` tetap menjadi registri status nomor (aktif/optout/invalid/last_bc). Alasannya, opt-out ditulis oleh workflow CS ke sheet itu, dan workflow CS sengaja tidak disentuh lebih dari satu node IF.

### Angka rupiah muncul di tiga layar sebelum tombol kirim

Sekarang tidak ada teks "Rp" di Step2, Step3, maupun Step4. Biaya per pesan tidak bisa dibaca API dengan token ini, jadi angkanya disimpan sebagai pengaturan `tarif_per_pesan` di KV. Nilai awal Rp 500, tarif rata-rata pesan marketing yang dipakai Nanan. Angka Rp 2.300 yang sempat dihitung dari satu kampanye Agustus (Rp 605.927 untuk 263 pesan) dibuang, karena itu biaya percakapan, bukan tarif per pesan marketing.

Tampilan. Step2 menampilkan perkiraan rupiah di tiap pilihan jumlah. Step3 menampilkan "sekitar Rp X untuk N tamu". Step4 mengulanginya di kalimat konfirmasi, dan pilihan "semua tamu" menuntut staf mengetik angka ribuan rupiahnya (misal "28") sebelum tombol tahan muncul. Semua diberi keterangan "perkiraan, tagihan pasti ada di WhatsApp Manager".

Dengan tarif awal itu, 200 tamu sekitar Rp 100 ribu, 1.000 tamu sekitar Rp 500 ribu, seluruh 12.559 nomor sekitar Rp 6,3 juta.

### Batas harian Meta ditangani dengan kuota yang dinaikkan bertahap, tanpa harus tahu angkanya

`messaging_limit_tier` tidak bisa dibaca token ini. Yang diketahui, puncak Agustus 387 pesan sehari lolos tanpa masalah, artinya KSA minimal di tingkat 1.000 nomor unik per 24 jam.

Tiga lapis.

- Kuota harian di aplikasi, pengaturan `batas_harian` di KV, nilai awal 1.000. `/api/kirim` menjumlahkan `terkirim` semua run 24 jam terakhir dari D1. Kalau pilihan staf melebihi sisa kuota, jumlahnya dipotong ke sisa kuota dan layar bilang "hari ini tersisa X tamu, sisanya bisa dikirim besok".
- Error Meta keluarga batas kecepatan (kode 130429, 131048, 131056, dan pesan yang memuat "rate limit") dipisah dari gagal biasa di node `Rapikan Hasil`. Statusnya `tertahan`, bukan `gagal`. `last_bc` tidak ditulis, `jml_failed` tidak naik, jadi tamu sehat tidak terbuang. Lima `tertahan` dalam satu batch menghentikan run dengan status `dihentikan_batas`. Layar bilang "Kena batas harian WhatsApp. N tamu belum dikirimi, lanjutkan besok dengan promo yang sama". Menjalankan ulang promo yang sama otomatis melewati tamu yang sudah menerima. `[BUTUH DATA: kode error persis saat tier terlampaui, diverifikasi di referensi error Graph API sebelum tahap 1 ditutup]`.
- Nanan membaca tingkat sebenarnya di WhatsApp Manager (menu Insights, bagian messaging limit), lalu menaikkan `batas_harian` dari halaman Tinjau. Meta menaikkan tingkat sendiri kalau kualitas tetap hijau dan pemakaian menyentuh setengah batas dalam 7 hari, jadi kuota yang naik bertahap sejalan dengan cara Meta bekerja.

### Nanan diberi tahu lewat WhatsApp dan email, plus pengingat pagi

Begitu staf menekan "Ajukan ke Mote", Cloudflare memanggil webhook n8n baru `ksa-bc-notif`. Workflow kecil `KSA - BC Notif` mengirim dua hal. Pesan WhatsApp ke nomor Nanan (628112131496) dari nomor KSA memakai template UTILITY `mote_tinjau_promo` yang dibuat sekali (kategori utility disetujui cepat dan tarifnya di bawah marketing). Email ke motekreatif@gmail.com lewat node Gmail yang sudah dipakai di agent WA. Cron 09.00 dan 16.00 mengirim pengingat kalau masih ada draf `menunggu_nanan` lebih dari 4 jam. Badge merah di menu Tinjau saat Nanan login. Komitmen yang ditulis di halaman staf, Mote meninjau dalam 1 hari kerja.

## Tahap 1 menutup empat lubang yang bisa bikin tagihan dobel

Tujuan. Staf hanya melihat promo yang berlaku. Tidak ada dua run berjalan bersamaan. Rupiah terlihat sebelum kirim. Error batas Meta tidak meracuni audience.

Yang disentuh.

| Path | Perubahan |
|---|---|
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/migrations/0001_awal.sql` (baru) | Tabel `promo`, `run`, `pesan`, `draf`, `daftar`, `daftar_nomor`. Indeks unik parsial run aktif |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/seed/promo-awal.json` (baru) | 17 baris metadata awal, 15 dengan `berlaku_sampai` lampau. Bukan rahasia |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/wrangler.toml` (baru) | Binding D1 `DB`, KV `BC_STATE`, R2 `ASET`. ID namespace bukan rahasia |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/functions/_lib/db.ts` (baru) | Akses D1 |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/functions/api/promos.ts` | Gabung hasil Meta (via n8n) dengan tabel `promo`, terapkan tiga syarat tampil |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/src/lib/katalog.ts` | Dihapus |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/src/components/Step1Promo.tsx` | Tombol "Tampilkan promo lama" dan daftar lama dihapus |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/src/components/Step2Jumlah.tsx` | Perkiraan Rp per pilihan, sisa kuota harian |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/src/components/Step3Pratinjau.tsx` | Baris "sekitar Rp X" |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/src/components/Step4Kirim.tsx` | Rp di konfirmasi, isian angka rupiah untuk "semua tamu" |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/functions/api/kirim.ts` | INSERT run dulu (kunci), potong ke sisa kuota, sertakan tarif |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/functions/api/run-aktif.ts` (baru) | Run yang sedang jalan, deteksi basi 15 menit |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/functions/api/progress-callback.ts` | Terima `target`, `tertahan_batch`, status `dihentikan_batas`, tulis ke D1 |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/functions/api/pengaturan.ts` (baru) | Baca/tulis `tarif_per_pesan`, `batas_harian` (tulis hanya admin, dipakai tahap 4) |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/functions/_lib/progres.ts` | Tipe status baru |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/src/components/Wizard.tsx` | Pemulihan dari `/api/run-aktif`, `localStorage` dihapus. Setelah error kirim, tombol terkunci sampai cek run-aktif selesai |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/src/components/Step5Progres.tsx` | Layar "Menyiapkan", peringatan basi 3 menit, layar `dihentikan_batas` dan `terputus` |
| n8n `N9BpBmZ59r8HmAwY` | `Balas Mulai` pindah setelah `Input Web`. `Rapikan Hasil` pisahkan `tertahan`. `Rem Darurat?` tambah cabang batas. `Lapor Progres` bawa `target` dan daftar wamid. `Tandai Sudah Dikirimi` lewati baris `tertahan`. `Input Web` terima `maks` yang sudah dipotong Cloudflare |

Cara uji.

1. `npm run typecheck` lolos. `wrangler d1 migrations apply` di lokal lolos.
2. Buka halaman. Hanya 2 promo tampil. Tidak ada tombol promo lama.
3. Pilih 200 tamu. Layar Step2 menunjukkan "sekitar Rp 100.000". Step4 mengulanginya.
4. Mode "Uji dulu" ke nomor Mote. Pesan sampai. Balasan `/api/kirim` datang di bawah 5 detik.
5. Dari dua HP, tekan kirim hampir bersamaan (mode Uji dulu). HP kedua mendapat 409 dan melompat ke layar progres run pertama.
6. Simulasi error batas. Ubah sementara `Rapikan Hasil` agar memperlakukan satu kode error uji sebagai `tertahan`, jalankan Uji dulu ke nomor yang sengaja salah format. Cek sheet, `last_bc` dan `jml_failed` tidak berubah.
7. Matikan workflow n8n di tengah run Uji dulu. Setelah 15 menit, `/api/run-aktif` melapor `terputus`, halaman mengizinkan run baru.

Cara batal. Cloudflare Pages, "Rollback to this deployment" ke deploy sebelumnya. n8n, impor ulang `/Users/nanansomanan/Documents/MOTÉ/10 - Project/01 - Project Active/Kampung Sumber Alam/09 - Broadcast WA/backup-workflow/N9BpBmZ59r8HmAwY-broadcast-web-2026-09-02.json`. Tabel D1 baru tidak mengganggu apa pun kalau kode lama kembali, karena kode lama tidak membacanya.

Gerbang keluar tahap 1. Ketujuh uji lolos, dan Nanan membuka halaman dari HP-nya sendiri dan hanya melihat 2 promo.

## Tahap 2 memindahkan 37 ribu event status ke D1 dan dibuktikan dengan 200 pesan nyata

Tujuan. Selama blast, workflow CS tidak menulis ke Sheets sama sekali. Status delivered/read per pesan tersimpan di D1. Sheet tetap diperbarui, sehari sekali.

Yang disentuh.

| Path | Perubahan |
|---|---|
| n8n `DYBEoQ4i5p6kuJ2Z` (workflow CS) | Satu node IF di posisi paling atas, cabang `statuses` ke HTTP POST Cloudflare lalu berhenti. Hanya itu |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/functions/api/status-callback.ts` (baru) | Terima payload Meta, UPDATE `pesan` per wamid, simpan `billable`, kumpulkan kode gagal permanen (131026) |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/functions/api/_middleware.ts` | Tambah `/api/status-callback` dan `/api/tulis-balik` ke `MACHINE_PATHS` |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/functions/api/tulis-balik.ts` (baru) | Ekspor perubahan status sejak waktu tertentu, untuk n8n |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/functions/api/progress.ts` | Tambah ringkasan delivered/read/tertagih dari `pesan` |
| n8n baru `KSA - BC Tulis Balik` | Cron 03.00, tarik ekspor, perbarui `BC - Log` dan `BC - Audience` massal. Kalau kena kuota Sheets, dicicil 500 baris per menit |
| Backup dulu | Ekspor JSON `DYBEoQ4i5p6kuJ2Z` ke folder `backup-workflow/` sebelum node IF ditambah |

Cara uji, dua lapis.

1. Sintetis. Kirim payload status buatan ke `/api/status-callback` dengan wamid yang ada dan yang tidak ada. Baris yang ada berubah, yang tidak ada tidak membuat baris baru. Kirim 100 payload paralel dengan `curl` untuk wamid yang sama, hitungan akhir tetap satu baris satu status tertinggi.
2. Nyata. Kirim `new_tripad_2026` (punya tombol Tripadvisor) ke 200 tamu lewat halaman, perkiraan biaya sekitar Rp 100 ribu, disetujui Nanan dulu. Selama kirim, buka daftar eksekusi workflow CS, tiap eksekusi status selesai di bawah 1 detik dan tidak menyentuh node Sheets. Setelah 24 jam, `/api/progress?run=` menampilkan delivered dan read yang masuk akal terhadap angka Agustus (delivered 99 persen, dibaca sekitar 43 persen). Pagi berikutnya, `BC - Log` dan `pernah_baca` di sheet sudah terisi oleh cron.

Cara batal. Nonaktifkan node IF di workflow CS (satu klik), status kembali ke jalur lama. Tabel `pesan` boleh dibiarkan.

Gerbang keluar tahap 2. Uji nyata 200 pesan lolos, dan selama kirim tidak ada balasan chat tamu yang tertunda lebih dari 1 menit (dicek dari eksekusi workflow CS).

## Tahap 3 memberi cangkang sidebar dan tab bawah yang lolos tiga lebar layar

Tujuan. Empat menu untuk staf (Dashboard, Kirim Promo, Buat Promo, Daftar Tamu), satu menu tambahan untuk Nanan (Tinjau). Laptop memakai sidebar kiri seperti Blaster (`/Users/nanansomanan/Documents/GitHub/mote-blaster/src/components/layout/Sidebar.tsx`, tersembunyi di bawah 768 px). HP memakai tab bawah, bukan hamburger, karena jempol lebih gampang mencapai bawah layar dan menunya cuma empat.

Yang disentuh.

| Path | Perubahan |
|---|---|
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/package.json` | Tambah `react-router-dom` |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/src/App.tsx` | Router, cangkang |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/src/components/Cangkang.tsx` (baru) | Sidebar ≥768 px, tab bawah <768 px, `padding-bottom` aman untuk iPhone (`viewport-fit=cover` sudah ada di `index.html`) |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/src/pages/KirimPromo.tsx` (baru) | Membungkus `Wizard` yang ada |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/scripts/tangkap-layar.mjs` (baru) | Playwright, tiga lebar 360, 768, 1280, semua halaman, simpan PNG ke `scratch/` (di-gitignore) |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/functions/_lib/auth.ts` | Cookie membawa peran `staf` atau `admin`. Secret baru `ADMIN_USER`, `ADMIN_PASS` di Cloudflare |

Cara uji. Jalankan `tangkap-layar.mjs`, buka PNG-nya, tidak ada teks terpotong dan tidak ada scroll mendatar. Lalu Nanan membuka dari HP-nya dan satu staf KSA membuka dari HP mereka, menu bawah terjangkau jempol, tombol minimal 44 px.

Cara batal. Rollback deploy. Tidak ada perubahan data.

Gerbang keluar tahap 3. Tangkapan layar tiga lebar disetujui Nanan.

## Tahap 4 membuat promo lewat mata Nanan dulu, baru ke Meta

Tujuan. Staf menulis teks, memasang gambar, memberi masa berlaku, dan mengajukan. Nanan meninjau, boleh mengedit, lalu menyetujui atau menolak. Persetujuan Nanan memicu pembuatan template di Meta. Status Menunggu Mote / Ditolak Mote / Menunggu Meta / Disetujui / Ditolak Meta terlihat staf, lengkap dengan alasan penolakan Meta (`rejected_reason`).

Fakta yang mendasari. Pembuatan template lewat API sudah dibuktikan hari ini dengan token `ksawabot` (`POST /1322073749294194/message_templates` mengembalikan id dan status PENDING). Token itu bertipe SYSTEM_USER dengan `expires_at 0`, artinya tidak kedaluwarsa. Token disimpan sebagai secret Cloudflare `META_TOKEN`, tidak pernah masuk repo. Bucket R2 `aset.kampungsumberalam.com` sudah ada di akun Sumberalamresort, sama dengan project Pages.

Batasan yang ditampilkan ke staf di formulir. Teks tanpa isian berubah-ubah (`{{1}}`), karena mesin kirim belum mendukungnya. Satu gambar JPG/PNG maksimal 5 MB, dipotong ke rasio 1,91 banding 1 di browser sebelum diunggah, sekaligus dibuat versi kecil untuk kartu. Satu tombol tautan opsional, misalnya ke booking engine. Masa berlaku wajib. Kategori selalu MARKETING, bahasa `id`. Edit setelah disetujui Meta dibatasi Meta 1 kali per 24 jam dan 10 kali per 30 hari, jadi formulir mengunci teks setelah diajukan, perubahan berarti draf baru.

Yang disentuh.

| Path | Perubahan |
|---|---|
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/src/pages/BuatPromo.tsx` (baru) | Formulir, pratinjau `WhatsappBubble` yang sudah ada, daftar draf dan statusnya |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/src/pages/Tinjau.tsx` (baru, admin) | Antrean draf, edit teks, setuju/tolak dengan catatan, pengaturan tarif dan kuota, daftar template tanpa masa berlaku |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/src/lib/gambar.ts` (baru) | Potong dan kecilkan gambar di browser (canvas) |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/functions/api/draf.ts` (baru) | Simpan dan baca draf di tabel `draf` |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/functions/api/draf-gambar.ts` (baru) | Unggah ke R2 lewat binding `ASET`, dua ukuran, nama file = nama template |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/functions/api/draf-setujui.ts` (baru, admin) | Unggah gambar ke Meta (Resumable Upload, dapat `header_handle`), `POST message_templates`, simpan `meta_template_id`, tulis baris `promo` dengan `berlaku_sampai` |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/functions/api/draf-tolak.ts` (baru, admin) | Tolak dengan catatan |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/functions/_lib/meta.ts` (baru) | Pembungkus Graph API dengan `META_TOKEN` |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/functions/api/promos.ts` | Gabungkan status Meta terbaru ke draf `menunggu_meta` tiap kali dimuat (polling, tanpa webhook tambahan) |
| n8n baru `KSA - BC Notif` | Webhook `ksa-bc-notif` dengan secret, kirim WA template `mote_tinjau_promo` ke Nanan dan email. Cron 09.00 dan 16.00 untuk pengingat |
| Meta | Buat 1 template UTILITY `mote_tinjau_promo` sekali |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/.gitignore` | Tambah `scratch/`, `*.db`, `.wrangler/` sudah ada |

Nama template dibuat otomatis dari nama ramah plus bulan, contoh `promo_oktober_2026_k3f7`, huruf kecil dan garis bawah saja sesuai aturan Meta dan pemeriksaan `permintaan.ts:19`.

Cara uji.

1. Staf (pakai login `ksa`) membuat draf "Promo Oktober" dengan gambar dan tombol, masa berlaku 31 Oktober 2026, tekan Ajukan. Nanan menerima WA dan email di bawah 5 menit.
2. Nanan membuka Tinjau dari HP, memperbaiki satu kata, menyetujui. Draf berubah `menunggu_meta`. Di WhatsApp Manager template baru terlihat PENDING.
3. Setelah Meta APPROVED (biasanya di bawah 1 jam, bisa sampai 24 jam), promo muncul di Kirim Promo tanpa ada yang menyentuh GitHub. Kirim Uji dulu ke nomor Mote, gambar dan tombol tampil.
4. Uji tolak. Draf kedua ditolak Nanan dengan catatan, staf melihat catatannya.
5. Uji penolakan Meta. Draf ketiga sengaja memuat teks yang biasanya ditolak (misal menyebut "klik di sini" tanpa tombol), staf melihat `rejected_reason`.
6. Cari string `EAA` dan `META_TOKEN=` di seluruh repo sebelum push, hasil nol.

Cara batal. Rollback deploy, menu Buat Promo dan Tinjau hilang. Template yang sudah dibuat di Meta tetap ada dan tetap terkendali lewat `berlaku_sampai`. Secret `META_TOKEN` bisa dicabut dari Cloudflare tanpa memengaruhi n8n, karena n8n memegang salinannya sendiri.

Gerbang keluar tahap 4. Satu promo buatan staf sampai ke HP Mote lewat jalur lengkap tanpa bantuan Mote di tengah.

## Tahap 5 membiarkan staf mengunggah daftar tamu sendiri dan mengirim hanya ke daftar itu

Tujuan. Staf mengunggah Excel/CSV ekspor reservasi, memberi nama daftar dan periode menginap, lalu memilih daftar itu sebagai penerima di Kirim Promo. Sheet `BC - Audience` tetap registri status nomor, dan nomor baru dari daftar ikut masuk ke sana supaya opt-out tercatat di satu tempat.

Yang disentuh.

| Path | Perubahan |
|---|---|
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/package.json` | Tambah `xlsx` (pembaca Excel di browser) |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/src/pages/DaftarTamu.tsx` (baru) | Unggah, tebak kolom nomor dan nama, normalisasi 628 di browser (logika `norm()` disalin persis dari node `Rapikan Kontak` workflow `3Ehfl2XV1HTqwnox`), laporan seperti tutorial (kolom dipakai, baru, dobel, rusak), daftar tersimpan dan jumlahnya |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/src/lib/nomor.ts` (baru) | `norm()` dan penebak kolom |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/functions/api/daftar.ts` (baru) | Simpan ke `daftar` dan `daftar_nomor` |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/functions/api/daftar-nomor.ts` (baru, machine) | Dibaca n8n saat run |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/src/components/Step1Promo.tsx` atau langkah baru | Pilihan penerima, "Semua tamu lolos saring" atau "Daftar: nama" |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/functions/_lib/permintaan.ts` | Field `daftar_id` opsional |
| n8n `N9BpBmZ59r8HmAwY` | `Input Web` terima `daftar_id`. Node baru `Ambil Daftar` (HTTP ke Cloudflare). `Saring Nomor` memakai daftar sebagai target dan sheet sebagai registri, filter optout/invalid/last_bc tetap berlaku. Nomor daftar yang belum ada di sheet ditambahkan dengan `sumber_file` = nama daftar (logika `Pilih Yang Baru` disalin) |

Soal tanggal menginap. Formulir unggah mewajibkan isian "periode menginap" (bulan dan tahun, atau tanggal check-out terakhir). Kalau daftar berisi tamu yang check-out kurang dari 14 hari lalu, Kirim Promo menampilkan peringatan kuning dan menyarankan menunggu. Angka 14 hari usulan Mote, bukan aturan Meta, disimpan sebagai pengaturan yang bisa Nanan ubah. `[BUTUH DATA: kebijakan KSA soal jarak minimal promo setelah tamu pulang]`.

Cara uji.

1. Unggah file `.xlsx` 300 baris ekspor reservasi dengan judul kolom acak. Laporan menunjuk kolom yang benar.
2. Unggah file yang sama dua kali. Tidak ada nomor dobel di daftar maupun di sheet.
3. Pilih daftar itu di Kirim Promo, mode "Uji dulu". Layar hitung menunjukkan total audience = jumlah daftar, bukan 12.559.
4. Kirim ke 25 tamu dari daftar (sekitar Rp 12,5 ribu). Sheet menerima nomor baru dengan `sumber_file` nama daftar, `last_bc` terisi untuk yang dikirimi.
5. Nomor yang sudah `optout` di sheet sengaja dimasukkan ke daftar, hasil hitung membuangnya.

Cara batal. Rollback deploy dan impor ulang JSON workflow. Tabel daftar dibiarkan.

Gerbang keluar tahap 5. Kelima uji lolos, dan staf KSA melakukan unggah pertamanya sendiri tanpa dipandu.

## Tahap 6 menampilkan dashboard dari dua sumber yang bisa dipercaya

Tujuan. Satu halaman untuk Nanan dan staf yang menjawab empat pertanyaan. Berapa pesan terkirim dan sampai bulan ini. Berapa yang dibaca. Berapa perkiraan biayanya. Sehat atau tidak nomor KSA hari ini.

Sumber angka. Terkirim dan delivered per hari dari endpoint `analytics` WABA Meta (sudah dibuktikan terbaca, Agustus 1.503 terkirim). Dibaca dan tertagih dari tabel `pesan` D1. Kualitas nomor (`quality_rating`, `status`) dari endpoint phone number Meta, ditampilkan sebagai lampu hijau/kuning/merah. Riwayat run dari tabel `run`. Antrean draf dari tabel `draf`. Semua panggilan Meta di-cache 10 menit di KV supaya halaman tidak menembak Meta tiap dibuka.

Yang disentuh.

| Path | Perubahan |
|---|---|
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/src/pages/Dashboard.tsx` (baru) | Kartu angka, grafik harian bulan ini, riwayat run, lampu kualitas |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/functions/api/dashboard.ts` (baru) | Gabungan sumber di atas |
| `/Users/nanansomanan/Documents/GitHub/bc-ksa/functions/_lib/meta.ts` | Tambah `analytics` dan phone number |

Grafik dibuat mengikuti skill `dataviz` dan `diagram-design` sesuai aturan kerja Mote, bukan chart bawaan library.

Cara uji. Angka Agustus di dashboard cocok dengan `analytics` Meta (1.503 terkirim, 1.498 delivered, puncak 387). Angka "dibaca" run 200 pesan tahap 2 cocok dengan `/api/progress`. Dibuka di HP 360 px, grafik bisa digulir mendatar di dalam kartunya, halaman tidak.

Cara batal. Rollback deploy. Tidak ada data yang ditulis tahap ini.

Gerbang keluar tahap 6. Nanan bisa menjawab keempat pertanyaan di atas dari HP tanpa membuka WhatsApp Manager.

## Enam hal sengaja tidak dibangun

- Jeda per pesan yang bisa diatur staf. Konsep itu penting di Blaster karena Baileys meniru manusia supaya nomor tidak diblokir. Di API resmi, jeda tidak melindungi akun. Yang melindungi akun adalah kuota harian, opt-out dihormati, dan rating kualitas. Batch 50 dengan jeda 5 detik dipertahankan hanya untuk melindungi n8n dan Sheets.
- Pesan teks bebas tanpa template. Meta melarangnya di luar jendela 24 jam. Tidak ada jalan teknis.
- Isian berubah-ubah (`{{1}}` nama tamu) di template. Mesin kirim belum mendukung, dan personalisasi menambah alasan Meta menolak template. Bisa jadi tahap 7 kalau ada bukti balasan naik.
- Pemindahan `BC - Audience` dari Google Sheets ke D1. Sheet itu ditulis workflow CS untuk opt-out. Memindahkannya berarti menyentuh workflow 49 node yang melayani chat tamu. Tidak sepadan sekarang.
- Pemindahan mesin kirim dari n8n ke Cloudflare Queues. Nanan minta tanpa VPS, dan n8n memang jalan di VPS Oracle. Mesin itu sudah hidup, 33 node, teruji Agustus. Menulis ulang loop kirim di Cloudflare adalah proyek sendiri dan baru masuk akal setelah tahap 1-6 stabil. Dicatat sebagai opsi, bukan dijanjikan.
- Menghapus 15 template lama dari Meta lewat kode. Disembunyikan lewat `berlaku_sampai` sudah cukup. Penghapusan adalah keputusan Nanan dan KSA.

## Tujuh risiko tetap ada setelah rencana ini jalan

1. Tingkat batas harian tetap tidak diketahui sampai Nanan membacanya di WhatsApp Manager. Kuota awal 1.000 menahan, tapi kalau tingkat sebenarnya lebih tinggi, KSA kirim lebih lambat dari yang bisa.
2. Tarif per pesan Rp 500 adalah rata-rata, bukan angka tagihan KSA. Semua rupiah di layar berlabel perkiraan, dan Nanan bisa menggantinya kapan saja dari halaman Tinjau.
3. Rating hijau bisa turun kalau staf mengunggah tamu yang baru pulang dan mengirim promo terlalu cepat. Peringatan 14 hari hanya peringatan, bukan penghalang.
4. Balasan tamu ke broadcast belum dihitung otomatis. Angka "1 persen membalas" Agustus dihitung tangan. Menghubungkan pesan masuk ke run butuh menyentuh workflow CS lebih dalam, ditunda.
5. Sheets tetap satu titik lemah. `Baca Audience` menarik 12.559 baris tiap run, sekitar 20 detik, dan akan melambat seiring audience tumbuh.
6. Paket Cloudflare. KV gratis dibatasi 1.000 tulis per hari dan Functions gratis dibatasi CPU pendek. D1 gratis memberi 100 ribu tulis per hari, cukup untuk 37 ribu status. Kalau volume naik atau agregasi dashboard berat, akun Sumberalamresort perlu Workers Paid, USD 5 per bulan. `[BUTUH DATA: paket Cloudflare akun Sumberalamresort saat ini]`.
7. Login bersama satu akun `ksa` berarti tidak ada jejak siapa yang menekan kirim. Peran admin memisahkan Nanan dari staf, tapi antar staf tetap anonim.

## Empat keputusan yang diminta dari Nanan sebelum tahap 1 dimulai

1. Setuju urutan tahap 1-2 mendahului Buat Promo, dengan konsekuensi halaman Buat Promo baru terlihat staf sekitar minggu ketiga.
2. Setuju uji nyata 200 pesan `new_tripad_2026` di tahap 2, perkiraan biaya Rp 100 ribu ditagih Meta ke KSA.
3. Isi tingkat batas harian dari WhatsApp Manager kalau sempat. Tanpa itu, layar memakai tarif Rp 500 dan kuota 1.000.
4. Putuskan bersama KSA, 15 template lama dihapus dari Meta atau cukup disembunyikan.
