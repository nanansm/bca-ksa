import { json, type Env } from '../_lib/auth'
import { callN8n } from '../_lib/n8n'

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const data = await callN8n<{ promos: unknown[] }>(env, 'ksa-bc-promos', {}, 30_000)
    return json(data)
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : 'Gagal mengambil daftar promo.' },
      { status: 502 },
    )
  }
}
