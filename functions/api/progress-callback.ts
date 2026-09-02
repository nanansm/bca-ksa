import { json, type Env } from '../_lib/auth'
import { kunciRun, TTL_RUN, type Progres } from '../_lib/progres'

interface Laporan {
  runId?: string
  status?: Progres['status']
  terkirim_batch?: number
  gagal_batch?: number
  terkirim?: number
  gagal?: number
}

/**
 * Dipanggil n8n, bukan browser. Sudah dijaga X-BC-Secret di _middleware.
 * Laporan per kelompok menambah; laporan "selesai" membawa angka final dan menimpa.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let laporan: Laporan
  try {
    laporan = (await request.json()) as Laporan
  } catch {
    return json({ error: 'bad body' }, { status: 400 })
  }

  const runId = String(laporan.runId || '')
  if (!runId) return json({ error: 'runId kosong' }, { status: 400 })

  const disimpan = await env.BC_STATE.get(kunciRun(runId))
  if (!disimpan) return json({ ok: true, catatan: 'run tidak dikenal, dilewati' })

  const progres = JSON.parse(disimpan) as Progres

  // n8n menjalankan cabang laporan dan cabang pencatatan terpisah, jadi laporan
  // kelompok bisa mendarat setelah laporan akhir. Begitu sebuah run ditutup,
  // laporan susulan diabaikan supaya angkanya tidak dihitung dua kali.
  if (progres.status !== 'jalan' && laporan.status !== 'selesai' && laporan.status !== 'dihentikan') {
    return json({ ok: true, catatan: 'run sudah ditutup, laporan susulan diabaikan' })
  }

  if (laporan.status === 'selesai') {
    progres.status = 'selesai'
    progres.terkirim = Number(laporan.terkirim ?? progres.terkirim)
    progres.gagal = Number(laporan.gagal ?? progres.gagal)
  } else if (laporan.status === 'dihentikan') {
    progres.status = 'dihentikan'
  } else {
    progres.terkirim += Number(laporan.terkirim_batch) || 0
    progres.gagal += Number(laporan.gagal_batch) || 0
  }

  progres.diperbarui = new Date().toISOString()
  await env.BC_STATE.put(kunciRun(runId), JSON.stringify(progres), { expirationTtl: TTL_RUN })

  return json({ ok: true })
}
