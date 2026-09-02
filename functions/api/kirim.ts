import { json, type Env } from '../_lib/auth'
import { callN8n } from '../_lib/n8n'
import { bacaPermintaan } from '../_lib/permintaan'
import { kunciRun, TTL_RUN, type Progres } from '../_lib/progres'

interface BalasanMulai {
  runId: string
  promo: string
  target: number
}

/** Kirim sungguhan. Halaman wajib menahan tombol dulu, tapi servernya tetap memeriksa. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const permintaan = await bacaPermintaan(request.clone())
  if ('error' in permintaan) return json({ error: permintaan.error }, { status: 400 })

  const { konfirmasi } = (await request.json()) as { konfirmasi?: boolean }
  if (konfirmasi !== true) {
    return json({ error: 'Pengiriman belum dikonfirmasi.' }, { status: 400 })
  }

  const runId = crypto.randomUUID()

  let balasan: BalasanMulai
  try {
    balasan = await callN8n<BalasanMulai>(env, 'ksa-bc-run', {
      ...permintaan,
      mode: 'LIVE',
      konfirmasi: true,
      runId,
    })
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : 'Gagal memulai pengiriman.' },
      { status: 502 },
    )
  }

  const sekarang = new Date().toISOString()
  const progres: Progres = {
    runId,
    status: 'jalan',
    promo: balasan.promo || permintaan.label,
    target: Number(balasan.target) || 0,
    terkirim: 0,
    gagal: 0,
    mulai: sekarang,
    diperbarui: sekarang,
  }
  await env.BC_STATE.put(kunciRun(runId), JSON.stringify(progres), { expirationTtl: TTL_RUN })

  return json({ ok: true, ...progres })
}
