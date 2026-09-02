-- Tahap 5: Daftar Tamu. `daftar` = satu unggahan bernama, `daftar_nomor` = nomor
-- bersihnya. Sheet `BC - Audience` tetap registri status (optout/invalid/last_bc);
-- daftar cuma menentukan SIAPA yang disasar, lihat KONTRAK-DAFTAR-TAMU.md.

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

-- Tidak ada indeks tambahan di daftar_nomor: PRIMARY KEY (daftar_id, nomor) sudah
-- membuat indeks unik yang diawali daftar_id, jadi pencarian per daftar sudah terlayani.
