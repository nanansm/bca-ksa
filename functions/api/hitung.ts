import { json, type Env } from '../_lib/auth'
import { callN8n } from '../_lib/n8n'
import { bacaPermintaan } from '../_lib/permintaan'

/** Hitungan kering: tidak ada satu pesan pun yang dikirim. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const permintaan = await bacaPermintaan(request)
  if ('error' in permintaan) return json({ error: permintaan.error }, { status: 400 })

  try {
    const data = await callN8n(env, 'ksa-bc-run', { ...permintaan, mode: 'DRY' })
    return json(data)
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : 'Gagal menghitung.' },
      { status: 502 },
    )
  }
}
