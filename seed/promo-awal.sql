-- Isi awal tabel promo, dipindah dari src/lib/katalog.ts (KATALOG) yang sekarang jadi
-- sumber statis lama. Nama, ringkasan, dan urutan disalin persis. `berlaku_sampai` diisi
-- manual per template — tanggal terakhir promo itu masih pantas ditampilkan.

INSERT INTO promo (template, nama, ringkas, berlaku_sampai, urut, dibuat) VALUES
  ('bc_for_last_year', 'Sapa Tamu Lama', 'Mengajak tamu lama menginap lagi. Tanpa tanggal, aman dipakai kapan saja.', NULL, 1, datetime('now')),
  ('new_tripad_2026', 'Minta Ulasan Tripadvisor', 'Meminta tamu memberi ulasan bintang 5. Punya tombol Tripadvisor.', NULL, 2, datetime('now')),
  ('broadcast_reminder', 'Pengingat Kangen Resort', 'Hampir sama persis dengan Sapa Tamu Lama.', '2026-08-31', 3, datetime('now')),
  ('romo_agustus_2026', 'Promo Agustus - diskon 17%', 'Diskon 17% semua tipe unit sepanjang Agustus.', '2026-08-31', 4, datetime('now')),
  ('holiday_school_2026', 'Promo Liburan Sekolah 2026', 'Paket keluarga saat libur sekolah.', '2026-07-31', 5, datetime('now')),
  ('promo_spesial_ramadan_2026', 'Promo Ramadan 2026', 'Paket buka puasa dan menginap.', '2026-03-31', 6, datetime('now')),
  ('early_bird_lebaran_2026', 'Early Bird Lebaran 2026', 'Pesan jauh hari untuk Lebaran.', '2026-04-30', 7, datetime('now')),
  ('early_bird_holiday_lebaran_2026', 'Early Bird Libur Lebaran 2026', 'Pesan jauh hari untuk libur Lebaran.', '2026-04-30', 8, datetime('now')),
  ('lebaran_2026', 'Lebaran 2026', 'Promo saat Lebaran berlangsung.', '2026-04-30', 9, datetime('now')),
  ('april_escape_2026', 'April Escape 2026', 'Promo menginap bulan April.', '2026-04-30', 10, datetime('now')),
  ('promo_holiday_2026', 'Promo Liburan 2026', 'Promo musim liburan.', '2026-07-31', 11, datetime('now')),
  ('holiday_new_26', 'Promo Liburan Tahun Baru 2026', 'Paket libur akhir tahun ke tahun baru.', '2026-01-31', 12, datetime('now')),
  ('promo_new_year_2026', 'Promo Tahun Baru 2026', 'Promo malam tahun baru.', '2026-01-31', 13, datetime('now')),
  ('early_bird_new_year_2026', 'Early Bird Tahun Baru 2026', 'Pesan jauh hari untuk tahun baru.', '2026-01-31', 14, datetime('now')),
  ('promo_akhir_tahun_2025', 'Promo Akhir Tahun 2025', 'Promo Desember 2025.', '2025-12-31', 15, datetime('now')),
  ('tripad', 'Minta Ulasan Tripadvisor (lama)', 'Versi lama permintaan ulasan, tanpa tombol.', '2026-08-31', 16, datetime('now')),
  ('tripad_2', 'Minta Ulasan Tripadvisor (v2)', 'Versi kedua permintaan ulasan, tanpa tombol.', '2026-08-31', 17, datetime('now'));
