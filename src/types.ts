export interface Tombol {
  teks: string
  tipe: string
}

/** Isian layar Buat Promo, bentuk persis body POST /api/promo-baru (lihat KONTRAK-BUAT-PROMO.md). */
export interface PermintaanPromoBaru {
  nama: string
  ringkas: string
  isi: string
  footer: string
  tombol: { tipe: 'situs' | 'balasan'; teks: string; url: string }
  berlaku_sampai: string
}

/** Balasan POST /api/promo-baru saat berhasil. */
export interface ResponPromoBaru {
  ok: true
  template: string
  status: string
}

/** Satu baris di daftar GET /api/promo-baru -- promo yang tercatat di D1 plus status Meta terbaru. */
export interface PromoBaruApi {
  template: string
  nama: string
  ringkas: string
  berlaku_sampai: string | null
  status: string
}

/**
 * Bentuk promo dari /api/promos. Server sudah menggabungkan data n8n (isi
 * pesan, tombol, dsb) dengan data katalog di D1 (nama ramah, ringkasan,
 * urutan tampil, tanggal berlaku). Layar tidak lagi punya katalog sendiri —
 * promo yang tidak lolos saring server memang tidak pernah dikirim ke sini.
 */
export interface PromoApi {
  template: string
  status: string
  isi_pesan: string
  footer: string
  butuh_gambar: boolean
  gambar_url: string
  tombol: Tombol[]
  bisa_dikirim: boolean
  alasan_tak_bisa: string
  nama: string
  ringkas: string
  urut: number
  berlaku_sampai: string | null
}

export interface DibuangRincian {
  sudah_optout: number
  nomor_mati: number
  nomor_rusak: number
  baru_dikirimi: number
  gagal_berulang: number
  tak_pernah_buka: number
  duplikat: number
}

export interface HitungResult {
  ok: true
  mode: 'DRY'
  promo: string
  template: string
  peringatan: string
  isi_pesan: string
  butuh_gambar: boolean
  gambar_url: string
  total_audience: number
  lolos_saring: number
  akan_dikirim: number
  dibuang: DibuangRincian
}

/** Nilai `maks` yang sah: -1 uji ke nomor Mote, 0 semua tamu. */
export type Maks = -1 | 25 | 200 | 1000 | 0

export type StatusRun =
  | 'menyiapkan' // sudah dikunci, n8n belum melapor
  | 'jalan'
  | 'selesai'
  | 'dihentikan' // rem darurat gagal beruntun
  | 'dihentikan_batas' // kena batas harian Meta
  | 'terputus' // tidak ada kabar > 15 menit
  | 'gagal_mulai' // n8n menolak setelah balasan dini

export interface Progres {
  runId: string
  status: StatusRun
  promo: string
  target: number // 0 selama masih 'menyiapkan'
  terkirim: number
  gagal: number
  tertahan: number // kena batas Meta, tamu TIDAK dianggap sudah dikirimi
  alasan: string // kosong kalau normal
  mulai: string // ISO
  diperbarui: string // ISO
}

/** Balasan POST /api/kirim: progres awal, plus info kalau kuota harian memotong jumlah yang diminta. */
export interface ResponKirim extends Progres {
  dipotong?: { diminta: number; dikirim: number }
}

export interface ResponPengaturan {
  ok: true
  tarif_per_pesan: number
  batas_harian: number
  terpakai_24j: number
  sisa_kuota: number
}

/** Satu titik grafik harian di dashboard, dari Meta `/{WABA}/analytics`. */
export interface DashboardHarian {
  tanggal: string // 'YYYY-MM-DD'
  terkirim: number
  sampai: number // delivered
}

/** Bentuk balasan GET /api/dashboard, lihat docs/KONTRAK-TAHAP-2.md. */
export interface DashboardApi {
  ok: true
  nomor: { display: string; kualitas: string; status: string }
  hari_ini: { terkirim: number; sisa_kuota: number; batas_harian: number }
  bulan_ini: {
    terkirim: number
    // sampai & dibaca null berarti tabel pesan masih kosong — layar WAJIB tampilkan
    // "belum ada datanya", bukan angka nol yang menyesatkan.
    sampai: number | null
    dibaca: number | null
    /** Rupiah. Tagihan Meta sebenarnya kalau `biaya_asli` true, kalau tidak hitungan tarif x jumlah. */
    biaya: number
    biaya_asli: boolean
  }
  harian: DashboardHarian[]
  run_terakhir: Progres[]
  diperbarui: string
  /** Bagian yang gagal diambil dari Meta ('nomor' / 'harian'). Absen kalau semua beres. */
  gagal?: string[]
}
