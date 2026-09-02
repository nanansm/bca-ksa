import { json } from '../_lib/auth'
import { ambilNomorDaftar, type Env } from '../_lib/db'

/**
 * MESIN (n8n), dijaga X-BC-Secret di _middleware. Node n8n memanggil ini tanpa cabang
 * IF, jadi broadcast "semua tamu" tetap memanggil dengan `id` kosong dan harus dapat
 * daftar kosong -- BUKAN 404. Diperiksa lewat NILAI, bukan `searchParams.has()`:
 * ekspresi n8n menghasilkan `?id=` (parameter ada, isinya kosong), dan `has()` membaca
 * itu sebagai ada lalu membalas 404 yang menghentikan seluruh broadcast.
 * `id` yang berisi tapi tidak ketemu di D1 tetap 404.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const id = (new URL(request.url).searchParams.get('id') ?? '').trim()
  if (!id) return json({ ok: true, nama: '', nomor: [] })

  const hasil = await ambilNomorDaftar(env, id)
  if (!hasil) return json({ error: 'Daftar tidak ditemukan.' }, { status: 404 })

  return json({ ok: true, nama: hasil.nama, nomor: hasil.nomor })
}
