-- Cron tulis-balik memindai `pesan` berdasarkan waktu perubahan. Tanpa indeks ini
-- kueri hariannya memindai seluruh tabel.
CREATE INDEX IF NOT EXISTS pesan_diperbarui ON pesan(diperbarui);
