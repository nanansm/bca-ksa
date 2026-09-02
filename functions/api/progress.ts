import { json } from '../_lib/auth'
import { ambilRun, type Env } from '../_lib/db'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const runId = new URL(request.url).searchParams.get('run') || ''
  if (!runId) return json({ error: 'runId kosong.' }, { status: 400 })

  const progres = await ambilRun(env, runId)
  if (!progres) return json({ error: 'Pengiriman tidak ditemukan.' }, { status: 404 })

  return json(progres)
}
