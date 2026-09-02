# Kontrak halaman Buat Promo

Lanjutan `KONTRAK-TAHAP-1.md` dan `KONTRAK-TAHAP-2.md`. Kalau kode dan dokumen ini beda,
dokumen ini yang benar.

## Keputusan yang mendasari

Staf KSA membuat promo langsung dari web app, dan template LANGSUNG diajukan ke Meta tanpa
menunggu persetujuan siapa pun. Tidak ada notifikasi ke Moté — diminta ditiadakan 2 Sep 2026.
Pengaman satu-satunya adalah validasi di form ini, jadi validasinya tidak boleh longgar.

## Fakta Meta yang sudah diverifikasi langsung (2 Sep 2026, token KSA)

- `POST /{WABA}/message_templates` dengan `category: "MARKETING"`, `language: "id"` BERHASIL,
  balas `{ id, status: "PENDING", category }`.
- `DELETE /{WABA}/message_templates?name=&hsm_id=` BERHASIL, balas `{ success: true }`.
- Komponen yang terbukti diterima: `BODY` (wajib), `FOOTER` (opsional),
  `BUTTONS` dengan satu tombol `URL` (`{type,text,url}`) ATAU `QUICK_REPLY` (`{type,text}`).
- **Link wa.me DITOLAK sebagai tombol URL.** Balasan Meta:
  `error_subcode 2388081`, `error_user_msg: "Tautan langsung ke WhatsApp tidak diizinkan untuk tombol."`
  Form WAJIB menolaknya lebih dulu dengan kalimatnya sendiri, jangan biarkan staf menabrak Meta.

## POST `/api/promo-baru` — butuh sesi login staf

Body:
```
{
  nama: string,            // "Promo Akhir Tahun 2026" — nama yang dilihat staf
  ringkas: string,         // kalimat kecil di kartu promo, boleh kosong
  isi: string,             // badan pesan
  footer: string,          // boleh kosong
  tombol: { tipe: 'situs' | 'balasan', teks: string, url: string },
  berlaku_sampai: string   // 'YYYY-MM-DD'
}
```

Validasi. Semua pesan error berbahasa Indonesia, kalimat utuh, tanpa istilah teknis Meta,
karena yang membacanya staf hotel. Balas `400 { error: string }` pada pelanggaran pertama:

| Aturan | Kalimat error |
|---|---|
| `nama` 3–60 huruf | "Nama promo terlalu pendek." / "Nama promo terlalu panjang, maksimal 60 huruf." |
| `ringkas` maksimal 120 huruf | "Keterangan singkat maksimal 120 huruf." |
| `isi` 30–1024 huruf | "Isi pesan terlalu pendek." / "Isi pesan maksimal 1.024 huruf." |
| `isi` mengandung `{{` atau `}}` | "Isi pesan tidak boleh memakai tanda {{ }}. Tulis kalimatnya lengkap." |
| `footer` maksimal 60 huruf | "Footer maksimal 60 huruf." |
| `tombol.teks` 1–25 huruf | "Tulisan tombol wajib diisi, maksimal 25 huruf." |
| tipe `situs`: `url` wajib diawali `https://` | "Link tombol harus diawali https://" |
| tipe `situs`: url mengandung `wa.me` atau `api.whatsapp.com` | "WhatsApp tidak mengizinkan link wa.me dipakai sebagai tombol. Pakai link website, atau ganti tombolnya jadi tombol balasan." |
| `berlaku_sampai` format `YYYY-MM-DD` dan >= hari ini Asia/Jakarta | "Masa berlaku wajib diisi, dan tidak boleh tanggal yang sudah lewat." |

Nama template digenerate, staf tidak pernah mengetiknya: huruf kecil, non-alfanumerik jadi `_`,
garis bawah beruntun dipadatkan, dipangkas di ujung, maksimal 60 karakter. Kalau namanya sudah
dipakai di Meta, tambahkan `_2`, `_3`, dan seterusnya sampai bebas.

Urutan kerja, dan JANGAN dibalik: ajukan ke Meta DULU, baru tulis ke D1. Kalau Meta menolak,
tabel `promo` tidak boleh ketambahan baris yang templatenya tidak ada.

1. Ambil daftar nama template dari Meta untuk memeriksa bentrok nama.
2. `POST /{WABA}/message_templates`.
   Meta menolak → balas `400 { error }` memakai `error_user_msg` dari Meta kalau ada,
   kalau tidak ada pakai `error.message`.
3. `INSERT INTO promo (template, nama, ringkas, berlaku_sampai, urut, dibuat)`,
   `urut` = urut terbesar yang ada + 1.
4. Balas `200 { ok: true, template: string, status: 'PENDING' }`.

## GET `/api/promo-baru` — butuh sesi login staf

Daftar promo yang tercatat di D1 beserta status Meta-nya, supaya staf bisa memantau promo yang
baru diajukan tanpa membuka WhatsApp Manager.

```
200 { ok: true, promos: [
  { template, nama, ringkas, berlaku_sampai, status } ] }
```
`status` = status Meta apa adanya (`APPROVED` / `PENDING` / `REJECTED` / dll), atau string kosong
kalau templatenya tidak ditemukan di Meta. Urut dari yang paling baru dibuat.

## Layar `src/pages/BuatPromo.tsx`

Tab ketiga di `Cangkang.tsx`, key `buat-promo`, label "Buat Promo".

- Form isian dengan pratinjau HIDUP di sebelahnya (di bawahnya kalau layar sempit), memakai
  `WhatsappBubble` yang sudah ada — staf melihat bentuk akhirnya sambil mengetik.
- Pilihan tombol cuma dua, ditulis dalam bahasa manusia:
  "Buka link website" (butuh isian link) dan "Tombol balasan cepat" (tanpa link).
- Penghitung sisa karakter isi pesan.
- Setelah berhasil: tampilkan kalimat bahwa promo sedang diperiksa WhatsApp, biasanya di bawah
  1 jam, dan akan muncul sendiri di daftar Kirim Promo begitu disetujui. Form dikosongkan.
- Di bawah form, daftar promo dari `GET /api/promo-baru` dengan lencana status yang sudah
  diterjemahkan: APPROVED → "Siap dipakai", PENDING → "Sedang diperiksa WhatsApp",
  REJECTED → "Ditolak WhatsApp".
- Wajib jalan di lebar 360px tanpa scroll horizontal, semua sasaran sentuh minimal 44px.
