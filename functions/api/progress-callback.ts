import { json } from '../_lib/auth'
import { ambilRun, statusAktif, terapkanLaporan, type Env, type LaporanCallback, type StatusRun } from '../_lib/db'

interface Laporan {
  runId?: string
  status?: StatusRun
  terkirim_batch?: number
  gagal_batch?: number
  tertahan_batch?: number
  target?: number
  terkirim?: number
  gagal?: number
  tertahan?: number
  alasan?: string
}

/**
 * Dipanggil n8n, bukan browser. Sudah dijaga X-BC-Secret di _middleware.
 * n8n menjalankan cabang laporan dan cabang pencatatan terpisah, jadi laporan kelompok
 * ('jalan') bisa mendarat setelah laporan akhir sudah menutup run. Begitu run tidak lagi
 * aktif, laporan 'jalan' susulan diabaikan supaya angkanya tidak dihitung dua kali.
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

  const progres = await ambilRun(env, runId)
  if (!progres) return json({ ok: true, catatan: 'run tidak dikenal, dilewati' })

  if (!statusAktif(progres.status) && laporan.status === 'jalan') {
    return json({ ok: true, catatan: 'run sudah ditutup, laporan susulan diabaikan' })
  }

  let dipakai: LaporanCallback
  if (laporan.status === 'jalan') {
    dipakai = {
      status: 'jalan',
      terkirimBatch: Number(laporan.terkirim_batch) || 0,
      gagalBatch: Number(laporan.gagal_batch) || 0,
      tertahanBatch: Number(laporan.tertahan_batch) || 0,
      ...(typeof laporan.target === 'number' ? { target: Number(laporan.target) } : {}),
    }
  } else if (laporan.status === 'selesai') {
    dipakai = {
      status: 'selesai',
      terkirim: Number(laporan.terkirim ?? progres.terkirim),
      gagal: Number(laporan.gagal ?? progres.gagal),
      tertahan: Number(laporan.tertahan ?? progres.tertahan),
    }
  } else if (
    laporan.status === 'dihentikan' ||
    laporan.status === 'dihentikan_batas' ||
    laporan.status === 'gagal_mulai'
  ) {
    dipakai = { status: laporan.status, alasan: String(laporan.alasan || '') }
  } else {
    return json({ error: 'status laporan tidak dikenali' }, { status: 400 })
  }

  await terapkanLaporan(env, runId, dipakai)

  return json({ ok: true })
}
