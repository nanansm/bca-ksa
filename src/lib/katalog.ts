/**
 * Nama ramah untuk tiap template WhatsApp. Meta hanya menyimpan nama teknis
 * (`bc_for_last_year`), jadi nama yang dibaca tim KSA ditulis di sini.
 *
 * Mengubah daftar ini tidak mengubah isi pesan — isi pesan hanya ada di
 * WhatsApp Manager. Yang berubah cuma yang tampil di layar.
 */
export interface EntriKatalog {
  nama: string
  ringkas: string
  /** Kosong berarti siap dikirim hari ini. Terisi berarti teksnya kedaluwarsa. */
  kedaluwarsa?: string
  urut: number
}

export const KATALOG: Record<string, EntriKatalog> = {
  bc_for_last_year: {
    nama: 'Sapa Tamu Lama',
    ringkas: 'Mengajak tamu lama menginap lagi. Tanpa tanggal, aman dipakai kapan saja.',
    urut: 1,
  },
  new_tripad_2026: {
    nama: 'Minta Ulasan Tripadvisor',
    ringkas: 'Meminta tamu memberi ulasan bintang 5. Punya tombol Tripadvisor.',
    urut: 2,
  },
  broadcast_reminder: {
    nama: 'Pengingat Kangen Resort',
    ringkas: 'Hampir sama persis dengan Sapa Tamu Lama.',
    kedaluwarsa: 'Isinya bertumpuk dengan Sapa Tamu Lama',
    urut: 3,
  },
  romo_agustus_2026: {
    nama: 'Promo Agustus - diskon 17%',
    ringkas: 'Diskon 17% semua tipe unit sepanjang Agustus.',
    kedaluwarsa: 'Menyebut bulan Agustus 2026',
    urut: 4,
  },
  holiday_school_2026: {
    nama: 'Promo Liburan Sekolah 2026',
    ringkas: 'Paket keluarga saat libur sekolah.',
    kedaluwarsa: 'Musim liburan sekolah sudah lewat',
    urut: 5,
  },
  promo_spesial_ramadan_2026: {
    nama: 'Promo Ramadan 2026',
    ringkas: 'Paket buka puasa dan menginap.',
    kedaluwarsa: 'Ramadan 2026 sudah lewat',
    urut: 6,
  },
  early_bird_lebaran_2026: {
    nama: 'Early Bird Lebaran 2026',
    ringkas: 'Pesan jauh hari untuk Lebaran.',
    kedaluwarsa: 'Lebaran 2026 sudah lewat',
    urut: 7,
  },
  early_bird_holiday_lebaran_2026: {
    nama: 'Early Bird Libur Lebaran 2026',
    ringkas: 'Pesan jauh hari untuk libur Lebaran.',
    kedaluwarsa: 'Lebaran 2026 sudah lewat',
    urut: 8,
  },
  lebaran_2026: {
    nama: 'Lebaran 2026',
    ringkas: 'Promo saat Lebaran berlangsung.',
    kedaluwarsa: 'Lebaran 2026 sudah lewat',
    urut: 9,
  },
  april_escape_2026: {
    nama: 'April Escape 2026',
    ringkas: 'Promo menginap bulan April.',
    kedaluwarsa: 'April 2026 sudah lewat',
    urut: 10,
  },
  promo_holiday_2026: {
    nama: 'Promo Liburan 2026',
    ringkas: 'Promo musim liburan.',
    kedaluwarsa: 'Tanggalnya perlu dicek ulang',
    urut: 11,
  },
  holiday_new_26: {
    nama: 'Promo Liburan Tahun Baru 2026',
    ringkas: 'Paket libur akhir tahun ke tahun baru.',
    kedaluwarsa: 'Tahun baru 2026 sudah lewat',
    urut: 12,
  },
  promo_new_year_2026: {
    nama: 'Promo Tahun Baru 2026',
    ringkas: 'Promo malam tahun baru.',
    kedaluwarsa: 'Tahun baru 2026 sudah lewat',
    urut: 13,
  },
  early_bird_new_year_2026: {
    nama: 'Early Bird Tahun Baru 2026',
    ringkas: 'Pesan jauh hari untuk tahun baru.',
    kedaluwarsa: 'Tahun baru 2026 sudah lewat',
    urut: 14,
  },
  promo_akhir_tahun_2025: {
    nama: 'Promo Akhir Tahun 2025',
    ringkas: 'Promo Desember 2025.',
    kedaluwarsa: 'Akhir tahun 2025 sudah lewat',
    urut: 15,
  },
  tripad: {
    nama: 'Minta Ulasan Tripadvisor (lama)',
    ringkas: 'Versi lama permintaan ulasan, tanpa tombol.',
    kedaluwarsa: 'Sudah diganti versi baru yang punya tombol',
    urut: 16,
  },
  tripad_2: {
    nama: 'Minta Ulasan Tripadvisor (v2)',
    ringkas: 'Versi kedua permintaan ulasan, tanpa tombol.',
    kedaluwarsa: 'Sudah diganti versi baru yang punya tombol',
    urut: 17,
  },
}

export function entriKatalog(template: string): EntriKatalog {
  return (
    KATALOG[template] ?? {
      nama: template,
      ringkas: 'Promo baru yang belum diberi nama di halaman ini.',
      kedaluwarsa: 'Belum diperiksa Mote',
      urut: 99,
    }
  )
}
