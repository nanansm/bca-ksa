import { json } from '../_lib/auth'
import { type Env, hitungTerpakai24Jam } from '../_lib/db'
import { bacaPengaturan } from '../_lib/pengaturan'

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const [pengaturan, terpakai24j] = await Promise.all([bacaPengaturan(env), hitungTerpakai24Jam(env)])

  return json({
    ok: true,
    tarif_per_pesan: pengaturan.tarifPerPesan,
    batas_harian: pengaturan.batasHarian,
    terpakai_24j: terpakai24j,
    sisa_kuota: Math.max(0, pengaturan.batasHarian - terpakai24j),
  })
}

// Peran admin baru ada di tahap 3 — sengaja ditolak dulu supaya tidak ada jalur
// tersembunyi buat mengubah tarif/batas sebelum ada pemeriksaan hak akses yang layak.
export const onRequestPut: PagesFunction<Env> = async () => {
  return json({ error: 'Pengaturan belum bisa diubah dari sini.' }, { status: 403 })
}
