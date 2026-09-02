import type { Env } from './auth'

/** Kunci KV untuk pengaturan yang bisa diubah staf lewat halaman admin (tahap 3). */
const KUNCI_TARIF = 'set:tarif_per_pesan'
const KUNCI_BATAS = 'set:batas_harian'

// Rp 586 = tarif marketing Indonesia yang benar-benar ditagih Meta ke KSA, dibaca dari
// pricing_analytics 30 hari terakhir (563.946,27 untuk 1.233 pesan). Bukan angka karangan.
const AWAL_TARIF = 586
const AWAL_BATAS = 1000

export interface Pengaturan {
  tarifPerPesan: number
  batasHarian: number
}

export async function bacaPengaturan(env: Env): Promise<Pengaturan> {
  const [tarif, batas] = await Promise.all([
    env.BC_STATE.get(KUNCI_TARIF),
    env.BC_STATE.get(KUNCI_BATAS),
  ])
  return {
    tarifPerPesan: tarif !== null ? Number(tarif) : AWAL_TARIF,
    batasHarian: batas !== null ? Number(batas) : AWAL_BATAS,
  }
}

export async function tulisTarifPerPesan(env: Env, nilai: number): Promise<void> {
  await env.BC_STATE.put(KUNCI_TARIF, String(nilai))
}

export async function tulisBatasHarian(env: Env, nilai: number): Promise<void> {
  await env.BC_STATE.put(KUNCI_BATAS, String(nilai))
}
