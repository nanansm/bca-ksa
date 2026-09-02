# Kontrak tahap 5 — Daftar Tamu

Staf mengunggah ekspor reservasi (`.xlsx` / `.csv`), sistem membersihkan nomornya,
menyimpannya sebagai satu **daftar** bernama, lalu daftar itu bisa dipilih sebagai
penerima di Kirim Promo. Menggantikan form n8n `KSA - Tambah Kontak` (`3Ehfl2XV1HTqwnox`).

Sheet `BC - Audience` TETAP registri status nomor (optout / invalid / last_bc), karena
workflow CS menulis opt-out ke sana. Daftar cuma menentukan SIAPA yang disasar; semua
filter lama tetap berlaku di atasnya.

## Batas yang tidak boleh dilanggar

- Parsing file terjadi di BROWSER. File tamu tidak pernah diunggah utuh ke server —
  yang dikirim cuma nomor yang sudah bersih. Ini menghindari batas ukuran request dan
  menjaga data tamu tidak tersimpan di mana-mana selain daftar nomornya.
- `norm()` WAJIB identik dengan yang dipakai n8n. Beda satu aturan = nomor yang lolos di
  satu sisi terbuang di sisi lain, dan selisihnya tidak akan pernah kelihatan sampai ada
  tamu yang tidak menerima promo.
- D1 maksimal **100 parameter terikat per pernyataan**. Insert massal WAJIB dipecah.

## Tabel D1 (migrasi `0004_daftar.sql`)

```sql
CREATE TABLE daftar (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  periode TEXT NOT NULL DEFAULT '',
  checkout_terakhir TEXT,
  jumlah INTEGER NOT NULL DEFAULT 0,
  siap INTEGER NOT NULL DEFAULT 0,
  dibuat TEXT NOT NULL
);

CREATE TABLE daftar_nomor (
  daftar_id TEXT NOT NULL,
  nomor TEXT NOT NULL,
  nama TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (daftar_id, nomor)
);

CREATE INDEX daftar_nomor_daftar ON daftar_nomor(daftar_id);
```

`siap = 0` berarti unggahan belum selesai (browser ditutup di tengah jalan). Daftar
`siap = 0` TIDAK boleh muncul sebagai pilihan penerima.

## `src/lib/nomor.ts` (baru)

Salin persis dari node `Rapikan Kontak`:

```ts
export function norm(x: unknown): string | null {
  let d = String(x ?? '').replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('6262')) d = '62' + d.slice(4)
  else if (d.startsWith('620')) d = '62' + d.slice(3)
  if (d.startsWith('0')) d = '62' + d.slice(1)
  else if (d.startsWith('8')) d = '62' + d
  if (!d.startsWith('628')) return null
  if (d.length < 11 || d.length > 14) return null
  return d
}
```

Penebak kolom, urutan wajib sama:

1. Cari header yang MEMUAT salah satu kata (huruf kecil):
   `nomor, no hp, nohp, phone, telp, telepon, hp, whatsapp, wa, mobile, contact, kontak`.
2. Kalau tidak ketemu, pilih kolom dengan `norm()` valid TERBANYAK.
3. Masih tidak ada juga → error `Tidak ada kolom berisi nomor HP di file ini.`

Kolom nama: header selain kolom nomor yang memuat `nama, name, guest, tamu, pemesan, customer`.

Fungsi `bacaBaris(rows)` mengembalikan:
`{ kolomNomor, kolomNama, barisFile, terbaca, rusak, kosong, dobelDiFile, nomor: {nomor, nama}[] }`
dengan aturan hitung persis seperti node n8n: sel kosong → `kosong`, `norm()` null → `rusak`,
nomor kembar di file yang sama → `dobelDiFile` (yang pertama saja dipakai).

## `functions/api/daftar.ts` (baru, sesi login)

Unggahan dipecah tiga panggilan supaya 12 ribu nomor tidak pernah lewat dalam satu request.

**`POST` `{aksi:'mulai', nama, periode, checkout_terakhir}`**
Validasi berurutan, balas pelanggaran PERTAMA, status 400:

| Aturan | Pesan |
|---|---|
| `nama` < 3 huruf | `Nama daftar terlalu pendek.` |
| `nama` > 60 huruf | `Nama daftar terlalu panjang, maksimal 60 huruf.` |
| `periode` kosong | `Periode menginap wajib diisi.` |
| `periode` > 60 huruf | `Periode menginap maksimal 60 huruf.` |
| `checkout_terakhir` diisi tapi bukan `YYYY-MM-DD` | `Tanggal check-out terakhir tidak terbaca.` |

`checkout_terakhir` BOLEH kosong (kirim `''` → simpan `NULL`). Balas `{ok:true, id}` dengan
`id = crypto.randomUUID()`, baris `siap = 0`.

**`POST` `{aksi:'tambah', id, nomor:[{nomor,nama}]}`**
Maksimal 500 nomor per panggilan (lebih → 400 `Potongan terlalu besar.`). Tolak kalau
`id` tidak ada atau `siap = 1` (400 `Daftar ini sudah dikunci.`). Setiap nomor dijalankan
ulang lewat `norm()` di server — nomor yang gagal DIBUANG diam-diam, bukan bikin error;
browser sudah menyaring, ini cuma jaring pengaman.
Tulis dengan `env.DB.batch()`: `INSERT OR IGNORE INTO daftar_nomor (daftar_id, nomor, nama)
VALUES (?,?,?),(?,?,?)...` **maksimal 25 baris per pernyataan** (75 parameter), maksimal 20
pernyataan per batch. Balas `{ok:true}`.

**`POST` `{aksi:'selesai', id}`**
`UPDATE daftar SET jumlah = (SELECT COUNT(*) FROM daftar_nomor WHERE daftar_id = ?), siap = 1
WHERE id = ?`. Balas `{ok:true, jumlah}`. Kalau `jumlah = 0` → hapus barisnya dan balas 400
`Tidak ada satu pun nomor yang bisa dipakai dari file ini.`

**`GET`** → `{ok:true, daftar:[{id, nama, periode, checkout_terakhir, jumlah, dibuat}]}`,
hanya `siap = 1`, terbaru dulu.

**`DELETE` `?id=`** → hapus `daftar_nomor` lalu `daftar`. Balas `{ok:true}`.

## `functions/api/daftar-nomor.ts` (baru, MESIN)

`GET ?id=` dengan header `X-BC-Secret`. WAJIB ditambahkan ke `MACHINE_PATHS` di
`functions/api/_middleware.ts`. Balas `{ok:true, nama, nomor:[{nomor, nama}]}` — n8n
memakai nama tamunya untuk menulis baris baru di sheet `BC - Audience`.
Ambil semua baris, tanpa paginasi — 12 ribu nomor ±480 KB, masih aman.
Parameter `id` TIDAK ADA di query → `{ok:true, nama:'', nomor:[]}` status 200, BUKAN 404:
node n8n memanggil endpoint ini tanpa cabang IF, jadi broadcast "semua tamu" tetap
memanggilnya dengan id kosong dan harus menerima daftar kosong.
`id` ada tapi tidak ketemu → 404 `{error:'Daftar tidak ditemukan.'}`.

## `functions/_lib/permintaan.ts`

Tambah field opsional `daftar_id`:
```ts
const daftarId = String(body.daftar_id ?? '').trim()
if (daftarId && !/^[0-9a-f-]{36}$/.test(daftarId)) return { error: 'Daftar tidak dikenali.' }
```
Ikut dikembalikan sebagai `daftar_id` (string kosong = semua tamu). Karena `hitung.ts` dan
`kirim.ts` menyebar `...permintaan` ke payload n8n, field ini otomatis sampai ke n8n.
JANGAN mengubah dua file itu.

## `src/pages/DaftarTamu.tsx` (baru)

Isian: nama daftar, periode menginap (teks bebas, contoh `Tamu menginap Agustus 2026`),
tanggal check-out terakhir (opsional), lalu pilih file.

Baca file dengan `xlsx` (tambahkan ke `package.json`) lewat **`await import('xlsx')`** —
dynamic import supaya pustakanya tidak ikut terbawa di bundel halaman lain.
`.csv` dan `.xlsx` sama-sama bisa dibaca `XLSX.read`; pakai `sheet_to_json(sheet, {defval:''})`
pada sheet pertama.

Setelah dibaca, tampilkan laporan SEBELUM menyimpan, dengan tombol `Simpan daftar ini`:

| Baris | Sumber angka |
|---|---|
| Kolom nomor yang dipakai | `kolomNomor` |
| Kolom nama yang dipakai | `kolomNama` atau `(tidak ada)` |
| Baris di file | `barisFile` |
| Nomor terbaca | `terbaca` |
| Dobel di dalam file | `dobelDiFile` |
| Format nomor rusak | `rusak` |
| Kolom nomor kosong | `kosong` |

Teks di bawah tabel: *"Periksa baris 'kolom nomor yang dipakai'. Kalau salah kolom, ganti
judul kolomnya jadi `nomor` di file lalu unggah lagi."*

Simpan = `mulai` → `tambah` per 500 nomor (tampilkan bar kemajuan `n dari total`) →
`selesai`. Gagal di tengah → tampilkan errornya; daftar tetap `siap = 0` dan tidak muncul
di mana pun.

Di bawahnya: daftar tersimpan (nama, periode, jumlah nomor, tanggal dibuat) + tombol hapus
yang meminta konfirmasi sekali klik kedua (pola yang sama seperti tombol lain di app ini).

## Pilihan penerima di Kirim Promo

`src/components/Step2Jumlah.tsx`: di ATAS lima pilihan jumlah, tambah pemilih penerima —
`Semua tamu` (bawaan) atau salah satu daftar tersimpan. Muat daftarnya lewat `api.daftarList()`.
Kalau belum ada daftar tersimpan, pemilihnya disembunyikan sepenuhnya (jangan tampilkan
kotak kosong). `daftar_id` yang terpilih ikut dikirim ke `api.hitung()` dan `api.kirim()`.

Peringatan kuning muncul kalau daftar terpilih punya `checkout_terakhir` dan jaraknya
KURANG dari 14 hari dari hari ini (Asia/Jakarta):
*"Tamu di daftar ini baru check-out N hari lalu. Mote menyarankan menunggu sampai 14 hari
supaya promonya tidak terasa mengganggu."* Peringatan saja — tidak memblokir.
Angka 14 ditaruh sebagai konstanta bernama `JARAK_MIN_HARI` di `src/components/Step2Jumlah.tsx`,
belum jadi pengaturan.

## Menu

`src/components/Cangkang.tsx` + `src/App.tsx`: tab keempat `daftar-tamu` / label `Daftar Tamu`.
Empat tab masih muat di lebar 360 px — periksa, jangan diperkirakan.

## Yang TIDAK dikerjakan subagent

Migrasi D1 ke database live, perubahan workflow n8n, dan uji live. Semua itu dikerjakan
model utama.
