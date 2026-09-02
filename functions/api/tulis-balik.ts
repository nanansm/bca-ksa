import { json } from '../_lib/auth'
import type { Env } from '../_lib/db'
import { ambilPerubahanSejak } from '../_lib/pesan'

/**
 * Dipanggil cron n8n jam 03.00 untuk menulis balik status pesan ke Google Sheet
 * sekali sehari. Mesin, dijaga X-BC-Secret di _middleware. Maksimal 2.000 baris
 * per panggilan (dibatasi di _lib/pesan.ts).
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const sejak = new URL(request.url).searchParams.get('sejak') || ''
  if (!sejak) return json({ error: 'sejak kosong' }, { status: 400 })

  const pesan = await ambilPerubahanSejak(env, sejak)
  // Kalau batch penuh (kena batas 2.000), lanjutkan dari baris terakhir supaya sisa
  // backlog tidak hilang. Kalau tidak ada yang berubah, "sampai" = sekarang -- memang
  // tidak ada apa-apa untuk ditulis balik sampai saat ini.
  const sampai = pesan.length > 0 ? pesan[pesan.length - 1].diperbarui : new Date().toISOString()

  return json({ ok: true, sampai, pesan })
}
