import { json } from '../_lib/auth'
import { ambilRun, type Env } from '../_lib/db'
import { ringkasanPesanRun } from '../_lib/pesan'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const runId = new URL(request.url).searchParams.get('run') || ''
  if (!runId) return json({ error: 'runId kosong.' }, { status: 400 })

  const progres = await ambilRun(env, runId)
  if (!progres) return json({ error: 'Pengiriman tidak ditemukan.' }, { status: 404 })

  // Tambahan tahap 2, turunan dari tabel pesan -- nol kalau belum ada datanya.
  const { sampai, dibaca } = await ringkasanPesanRun(env, runId)

  return json({ ...progres, sampai, dibaca })
}
