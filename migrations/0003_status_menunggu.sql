-- Status dari Meta sering tiba SEBELUM n8n sempat melaporkan daftar wamid satu kelompok
-- kirim. Sebelum tabel ini ada, status itu dibuang permanen ("wamid tak dikenal") dan
-- pesan mentok di 'terkirim' selamanya -- terbukti 2 Sep 2026: 24 dari 25 pesan kehilangan
-- status delivered-nya. Di sini status yatim ditahan sebentar, lalu diterapkan begitu
-- barisnya muncul di tabel `pesan`.
CREATE TABLE IF NOT EXISTS status_menunggu (
  wamid TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  billable INTEGER,
  waktu TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS status_menunggu_waktu ON status_menunggu(waktu);
