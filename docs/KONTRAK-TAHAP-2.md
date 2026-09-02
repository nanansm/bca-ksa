# Kontrak API tahap 2 dan dashboard

Lanjutan `KONTRAK-TAHAP-1.md`. Kalau kode dan dokumen ini beda, dokumen ini yang benar.

## Kenapa tahap ini ada

Status delivered/read dari Meta sekarang diproses workflow CS `DYBEoQ4i5p6kuJ2Z`, workflow yang
sama yang melayani chat tamu. Tiap event mencari wamid di Google Sheet. Blast 12.559 nomor
melahirkan sekitar 37 ribu event, sedangkan kuota Sheets 60 tulis per menit. Akibatnya balasan
CS ke tamu ikut mengantre. Tahap ini memindahkan event status ke D1.

## Binding baru di Pages

`META_TOKEN`, `META_WABA_ID`, `META_PHONE_ID` -- ketiganya bertipe `secret_text`.
Nilainya ada di dashboard Cloudflare Pages dan di `~/.config/ksa-meta/`, TIDAK di repo ini (repo publik).
Ketiganya sudah terpasang di production dan preview. Token bertipe SYSTEM_USER, tidak kedaluwarsa.
DILARANG menulis nilainya ke repo.

## Tabel `pesan` (sudah dibuat di migrasi 0001)

```
wamid TEXT PRIMARY KEY, run_id TEXT, nomor TEXT,
status_terakhir TEXT DEFAULT 'terkirim', billable INTEGER, diperbarui TEXT
```
Urutan status yang boleh maju, tidak boleh mundur:
`terkirim` < `sampai` < `dibaca` , dan `gagal` berdiri sendiri (menang atas semuanya).
Payload Meta memakai istilah `sent`, `delivered`, `read`, `failed`.

## Endpoint

### POST `/api/progress-callback` — tambahan field
Selain bentuk lama, body boleh membawa daftar pesan satu kelompok:
```
{ runId, status:'jalan', terkirim_batch, gagal_batch, tertahan_batch,
  pesan: [{ wamid: string, nomor: string }] }
```
`pesan` disimpan dengan `INSERT OR IGNORE` ke tabel `pesan` (wamid = kunci, jadi kiriman ulang
tidak menggandakan). Daftar kosong atau tidak ada berarti tidak ada yang disimpan.

### POST `/api/status-callback` — mesin, header `X-BC-Secret`
Menerima payload webhook Meta apa adanya:
```
{ entry: [ { changes: [ { value: { statuses: [
    { id, status, timestamp, recipient_id,
      pricing?: { billable: boolean, category: string },
      errors?: [ { code: number, title: string } ] } ] } } ] } ] }
```
Untuk tiap `statuses[]`: `UPDATE pesan SET status_terakhir = ?, billable = ?, diperbarui = ?
WHERE wamid = ? AND <status baru lebih maju dari yang tersimpan>`. Wamid tak dikenal DILEWATI,
jangan membuat baris baru — chat CS biasa juga lewat sini.
Balasan `200 { ok: true, dikenal: number, dilewati: number }`. Selalu 200 selama secret benar,
supaya n8n tidak mengulang-ulang.

### GET `/api/tulis-balik?sejak=<ISO>` — mesin, header `X-BC-Secret`
```
200 { ok: true, sampai: string, pesan: [
  { wamid, nomor, run_id, status_terakhir, billable, diperbarui } ] }
```
Maksimal 2.000 baris per panggilan, urut `diperbarui`, lalu `wamid`, menaik. Batasnya `>=`, bukan
`>`: satu kelompok webhook memberi `diperbarui` yang sama persis ke banyak baris, dan kursor `>`
akan membuang sisa baris berwaktu kembar kalau halaman terpotong di tengahnya. Penulisan ke Sheet
dicocokkan per wamid sehingga baris yang terkirim dua kali menimpa dirinya sendiri. Dipakai cron n8n jam 03.00 untuk
menulis balik ke Google Sheet sekali sehari.

### GET `/api/progress?run=` — tambahan field
`Progres` bertambah dua kolom turunan dari tabel `pesan`:
```
sampai: number     // delivered
dibaca: number
```
Nol kalau belum ada datanya. Jangan mengubah field lama.

### GET `/api/dashboard`
```
200 {
  ok: true,
  nomor:      { display: string, kualitas: string, status: string },
  hari_ini:   { terkirim: number, sisa_kuota: number, batas_harian: number },
  bulan_ini:  { terkirim: number, sampai: number | null, dibaca: number | null,
                perkiraan_biaya: number },
  harian:     [ { tanggal: 'YYYY-MM-DD', terkirim: number, sampai: number } ],
  run_terakhir: Progres[],
  diperbarui: string,
  gagal?: string[]        // 'nomor' / 'harian', hanya muncul kalau Meta gagal dijawab
}
```
Sumber angka, jangan tertukar:
- `harian` dari Meta `GET /{WABA}/analytics` (`sent`, `delivered`), 30 hari terakhir,
  granularity DAY. Angka ini mencakup SELURUH lalu lintas nomor termasuk balasan CS, jadi layar
  wajib melabelinya begitu dan TIDAK boleh menyebutnya angka promo. Meta memotong hari menurut
  zona waktu nomor: `start` jatuh di 17.00 UTC, geser +7 jam sebelum diambil tanggalnya.
- `bulan_ini.terkirim` dari D1 (`SUM(run.terkirim)` sejak awal bulan Jakarta) — khusus broadcast,
  supaya cocok dengan `perkiraan_biaya`. Jangan memakai angka Meta di sini.
- `bulan_ini.sampai` dan `bulan_ini.dibaca` dari tabel `pesan`. Keduanya `null` selama tabel masih
  kosong — layar harus menampilkan "belum ada datanya", BUKAN angka nol yang menyesatkan.
- `nomor` dari Meta `GET /{PHONE_ID}?fields=display_phone_number,quality_rating,status`.
- `hari_ini` dari tabel `run` dan pengaturan KV, sama seperti `/api/pengaturan`.
- `perkiraan_biaya` = `bulan_ini.terkirim` x `tarif_per_pesan`. Selalu berlabel perkiraan.

Semua panggilan Meta disimpan di KV 10 menit (`cache:meta:*`) supaya halaman tidak menembak Meta
tiap kali dibuka. Meta gagal dijawab bukan alasan halaman kosong: sajikan bagian yang berhasil,
tandai bagian yang gagal.
