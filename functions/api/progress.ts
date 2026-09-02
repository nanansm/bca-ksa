import { json, type Env } from '../_lib/auth'
import { kunciRun } from '../_lib/progres'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const runId = new URL(request.url).searchParams.get('run') || ''
  if (!runId) return json({ error: 'runId kosong.' }, { status: 400 })

  const disimpan = await env.BC_STATE.get(kunciRun(runId))
  if (!disimpan) return json({ error: 'Pengiriman tidak ditemukan.' }, { status: 404 })

  return json(JSON.parse(disimpan))
}
