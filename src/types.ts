export interface Tombol {
  teks: string
  tipe: string
}

/** Bentuk mentah satu promo dari /api/promos. */
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
}

/** Promo API digabung dengan data katalog (nama ramah, ringkasan, urutan). */
export interface PromoView extends PromoApi {
  nama: string
  ringkas: string
  kedaluwarsa?: string
  urut: number
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

export type StatusKirim = 'jalan' | 'selesai' | 'dihentikan'

export interface KirimResult {
  ok: true
  runId: string
  status: StatusKirim
  promo: string
  target: number
  terkirim: number
  gagal: number
  mulai: string
  diperbarui: string
}

/** Nilai `maks` yang sah: -1 uji ke nomor Mote, 0 semua tamu. */
export type Maks = -1 | 25 | 200 | 1000 | 0

export interface PilihanKirim {
  promo: PromoView
  maks: Maks
}
