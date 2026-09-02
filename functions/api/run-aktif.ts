import { json } from '../_lib/auth'
import { ambilRunAktif, tandaiTerputusJikaBasi, type Env } from '../_lib/db'

/**
 * Dipanggil halaman saat dibuka/refresh untuk tahu apakah ada broadcast yang masih
 * berjalan. Sebelum menjawab, run yang sudah 15 menit tidak melapor ditandai 'terputus'
 * supaya kuncinya lepas — kalau tidak, staf tidak akan pernah bisa kirim lagi setelah
 * n8n mati di tengah jalan.
 */
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  await tandaiTerputusJikaBasi(env)
  const run = await ambilRunAktif(env)
  return json({ ok: true, run })
}
