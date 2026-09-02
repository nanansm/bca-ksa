-- Skema awal D1. Promo = katalog tampilan (dulu di src/lib/katalog.ts, sekarang di database
-- supaya bisa diubah tanpa deploy ulang). Run = satu kali proses broadcast. Pesan disiapkan
-- untuk tahap 2 (pelacakan per nomor), sengaja belum diisi apa pun di tahap ini.

CREATE TABLE promo (
  template TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  ringkas TEXT NOT NULL DEFAULT '',
  berlaku_sampai TEXT,
  urut INTEGER NOT NULL DEFAULT 99,
  dibuat TEXT NOT NULL
);

CREATE TABLE run (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  promo TEXT NOT NULL,
  template TEXT NOT NULL,
  maks INTEGER NOT NULL,
  target INTEGER NOT NULL DEFAULT 0,
  terkirim INTEGER NOT NULL DEFAULT 0,
  gagal INTEGER NOT NULL DEFAULT 0,
  tertahan INTEGER NOT NULL DEFAULT 0,
  alasan TEXT NOT NULL DEFAULT '',
  mulai TEXT NOT NULL,
  diperbarui TEXT NOT NULL,
  -- Kolom kunci, bukan data. Diisi 1 saat status 'menyiapkan'/'jalan', NULL selain itu.
  -- SQLite mengabaikan NULL pada indeks unik, jadi cuma satu baris "aktif" yang bisa ada
  -- kapan pun — indeks unik langsung di kolom `status` tidak cukup karena dua status aktif
  -- berbeda ('menyiapkan' dan 'jalan') tetap lolos sebagai dua nilai berbeda.
  aktif INTEGER
);

CREATE UNIQUE INDEX run_aktif_tunggal ON run(aktif);

CREATE TABLE pesan (
  wamid TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  nomor TEXT NOT NULL,
  status_terakhir TEXT NOT NULL DEFAULT 'terkirim',
  billable INTEGER,
  diperbarui TEXT NOT NULL
);

CREATE INDEX pesan_run_id ON pesan(run_id);
