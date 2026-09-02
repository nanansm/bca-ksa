import { json } from '../_lib/auth'
import type { Env } from '../_lib/db'
import { terapkanStatusMeta, type StatusMeta } from '../_lib/pesan'

interface WebhookMeta {
  entry?: { changes?: { value?: { statuses?: StatusMeta[] } }[] }[]
}

/**
 * Dipanggil n8n (workflow CS), bukan browser. Dijaga X-BC-Secret di _middleware.
 * Menerima payload webhook Meta apa adanya. Selalu 200 selama secret benar, supaya
 * n8n tidak mengulang-ulang -- payload yang gagal diparsing bukan sesuatu yang bisa
 * diperbaiki dengan mengulang.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: WebhookMeta
  try {
    body = (await request.json()) as WebhookMeta
  } catch {
    return json({ ok: true, dikenal: 0, dilewati: 0 })
  }

  const statuses: StatusMeta[] = []
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const s of change.value?.statuses ?? []) statuses.push(s)
    }
  }

  const { dikenal, dilewati } = await terapkanStatusMeta(env, statuses)
  return json({ ok: true, dikenal, dilewati })
}
