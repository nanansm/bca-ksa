import { json } from '../_lib/auth'
import { ambilNomorDaftar, type Env } from '../_lib/db'

/**
 * MESIN (n8n), dijaga X-BC-Secret di _middleware. Node n8n memanggil ini tanpa cabang
 * IF, jadi broadcast "semua tamu" tetap memanggil dengan `id` kosong dan harus dapat
 * daftar kosong -- BUKAN 404. `id` yang ADA tapi tidak ketemu di D1 tetap 404.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url)
  if (!url.searchParams.has('id')) return json({ ok: true, nama: '', nomor: [] })

  const id = url.searchParams.get('id') ?? ''
  const hasil = await ambilNomorDaftar(env, id)
  if (!hasil) return json({ error: 'Daftar tidak ditemukan.' }, { status: 404 })

  return json({ ok: true, nama: hasil.nama, nomor: hasil.nomor })
}
