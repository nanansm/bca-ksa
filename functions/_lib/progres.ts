export interface Progres {
  runId: string
  status: 'jalan' | 'selesai' | 'dihentikan'
  promo: string
  target: number
  terkirim: number
  gagal: number
  mulai: string
  diperbarui: string
}

export const kunciRun = (runId: string) => `run:${runId}`

/** Progres disimpan 7 hari — cukup untuk dibuka lagi keesokan harinya. */
export const TTL_RUN = 7 * 24 * 60 * 60
