# Kontrak API tahap 1

Acuan tunggal untuk sisi server dan sisi layar. Kalau kode dan dokumen ini beda, dokumen ini yang benar.

## Penyimpanan

- D1 binding `DB` (database `bc-ksa`, uuid `82330bd1-e34e-461f-9017-341f694a7679`). Sumber kebenaran untuk promo, run, pesan.
- KV binding `BC_STATE`. Tetap dipakai untuk sesi login, rem login, dan pengaturan. Bukan lagi untuk progres run.

## Pengaturan (KV)

| Kunci | Awal | Arti |
|---|---|---|
| `set:tarif_per_pesan` | `500` | rupiah per pesan marketing, perkiraan |
| `set:batas_harian` | `1000` | nomor unik per 24 jam |

## Tipe bersama

```ts
export type StatusRun =
  | 'menyiapkan'        // sudah dikunci, n8n belum melapor
  | 'jalan'
  | 'selesai'
  | 'dihentikan'        // rem darurat gagal beruntun
  | 'dihentikan_batas'  // kena batas harian Meta
  | 'terputus'          // tidak ada kabar > 15 menit
  | 'gagal_mulai'       // n8n menolak setelah balasan dini

export interface Progres {
  runId: string
  status: StatusRun
  promo: string
  target: number      // 0 selama masih 'menyiapkan'
  terkirim: number
  gagal: number
  tertahan: number    // kena batas Meta, tamu TIDAK dianggap sudah dikirimi
  alasan: string      // kosong kalau normal
  mulai: string       // ISO
  diperbarui: string  // ISO
}
```

## Endpoint

### GET `/api/promos`
```
200 { ok: true, promos: Promo[] }
```
`Promo` = bentuk lama dari n8n ditambah kolom D1:
```ts
interface Promo {
  template: string; status: string; isi_pesan: string; footer: string
  butuh_gambar: boolean; gambar_url: string; tombol: {teks:string;tipe:string}[]
  bisa_dikirim: boolean; alasan_tak_bisa: string
  nama: string; ringkas: string; urut: number
  berlaku_sampai: string | null   // 'YYYY-MM-DD'
}
```
Aturan tampil, ketiganya wajib: status Meta `APPROVED`, ada baris di tabel `promo`, `berlaku_sampai` kosong atau >= hari ini (zona Asia/Jakarta). Yang tidak lolos TIDAK dikirim ke layar sama sekali. Tidak ada lagi daftar promo lama.

### GET `/api/pengaturan`
```
200 { ok: true, tarif_per_pesan: number, batas_harian: number,
      terpakai_24j: number, sisa_kuota: number }
```
`terpakai_24j` = jumlah `terkirim` semua run yang `mulai` dalam 24 jam terakhir.

### POST `/api/hitung`  (tidak berubah bentuknya)
Body `{template,label,maks}`. Tetap menunggu jawaban penuh n8n.

### POST `/api/kirim`
Body `{template,label,maks,konfirmasi:true}`.
```
200 { ok: true, ...Progres, dipotong?: { diminta:number, dikirim:number } }
409 { error: string, run: Progres }        // sudah ada run aktif
429 { error: string }                      // jatah kirim hari ini habis
400 { error: string }
502 { error: string }
```
`dipotong.diminta` bernilai `0` berarti staf memilih "semua tamu" dan jumlahnya diganti sisa kuota.
Urutan wajib: kunci run di D1 DULU (INSERT), baru panggil n8n. INSERT gagal karena indeks unik = 409. Kalau panggilan n8n gagal, baris run ditandai `gagal_mulai` supaya kunci lepas.
Pemotongan kuota: kalau `maks` melebihi sisa kuota harian, kirim sisa kuota saja dan isi `dipotong`. `maks: 0` ("semua tamu") SELALU diganti sisa kuota, karena justru pilihan itu yang paling butuh dipagari. Sisa kuota nol dijawab 429. `maks: -1` (uji) tidak kena kuota.

### GET `/api/run-aktif`
```
200 { ok: true, run: Progres | null }
```
Sebelum menjawab, tandai `terputus` setiap run berstatus `menyiapkan`/`jalan` yang `diperbarui`-nya lebih tua dari 15 menit, lalu jawab `null`.

### GET `/api/progress?run=<id>`
```
200 Progres
404 { error }
```

### POST `/api/progress-callback`  (mesin, header `X-BC-Secret`)
Body dari n8n, salah satu:
```
{ runId, status:'jalan', terkirim_batch, gagal_batch, tertahan_batch?, target? }
{ runId, status:'selesai', terkirim, gagal, tertahan? }
{ runId, status:'dihentikan'|'dihentikan_batas'|'gagal_mulai', alasan? }
```
Aturan lama tetap berlaku: begitu run ditutup, laporan susulan berstatus `jalan` diabaikan.

## Aturan yang tidak boleh dilanggar

- Repo ini PUBLIK. Tidak boleh ada token, password, URL webhook, atau secret di file mana pun.
- Semua teks yang dibaca staf memakai Bahasa Indonesia, tanpa istilah teknis telanjang.
- Rupiah selalu diberi keterangan "perkiraan".
