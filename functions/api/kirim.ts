import { json } from '../_lib/auth'
import { callN8n } from '../_lib/n8n'
import { bacaPermintaan } from '../_lib/permintaan'
import { ambilRun, hitungTerpakai24Jam, kunciRunBaru, tandaiGagalMulai, tandaiJalan, type Env } from '../_lib/db'
import { bacaPengaturan } from '../_lib/pengaturan'

interface BalasanMulai {
  runId: string
  promo: string
  target: number
}

/**
 * Kirim sungguhan. Halaman wajib menahan tombol dulu, tapi servernya tetap memeriksa.
 * Urutan wajib: kunci run di D1 DULU, baru panggil n8n — supaya dua klik beruntun
 * (atau dua staf berbeda) tidak pernah memulai dua broadcast sekaligus.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const permintaan = await bacaPermintaan(request.clone())
  if ('error' in permintaan) return json({ error: permintaan.error }, { status: 400 })

  const { konfirmasi } = (await request.json()) as { konfirmasi?: boolean }
  if (konfirmasi !== true) {
    return json({ error: 'Pengiriman belum dikonfirmasi.' }, { status: 400 })
  }

  // Uji ke nomor Mote (maks -1) tidak menyentuh kuota harian sama sekali.
  // maks 0 berarti "semua tamu" — justru pilihan inilah yang paling butuh dipagari kuota,
  // jadi angkanya selalu diganti sisa kuota hari ini, bukan dilewatkan begitu saja.
  let maksKirim = permintaan.maks
  let dipotong: { diminta: number; dikirim: number } | undefined
  if (permintaan.maks !== -1) {
    const [pengaturan, terpakai24j] = await Promise.all([bacaPengaturan(env), hitungTerpakai24Jam(env)])
    const sisaKuota = Math.max(0, pengaturan.batasHarian - terpakai24j)
    if (sisaKuota === 0) {
      return json(
        {
          error:
            'Jatah kirim hari ini sudah habis. Pengiriman bisa dilanjutkan besok dengan promo yang sama, tamu yang sudah menerima tidak akan dikirimi dua kali.',
        },
        { status: 429 },
      )
    }
    if (permintaan.maks === 0 || permintaan.maks > sisaKuota) {
      // diminta 0 dibaca layar sebagai "semua tamu".
      dipotong = { diminta: permintaan.maks, dikirim: sisaKuota }
      maksKirim = sisaKuota
    }
  }

  const runId = crypto.randomUUID()
  const kunci = await kunciRunBaru(env, {
    id: runId,
    promo: permintaan.label,
    template: permintaan.template,
    maks: maksKirim,
  })
  if (!kunci.ok) {
    return json(
      {
        error: 'Masih ada pengiriman lain yang sedang berjalan. Tunggu sampai selesai dulu.',
        run: kunci.aktif,
      },
      { status: 409 },
    )
  }

  let balasan: BalasanMulai
  try {
    balasan = await callN8n<BalasanMulai>(env, 'ksa-bc-run', {
      ...permintaan,
      maks: maksKirim,
      mode: 'LIVE',
      konfirmasi: true,
      runId,
    })
  } catch (err) {
    const alasan = err instanceof Error ? err.message : 'Gagal memulai pengiriman.'
    await tandaiGagalMulai(env, runId, alasan)
    return json({ error: alasan }, { status: 502 })
  }

  await tandaiJalan(env, runId, Number(balasan.target) || 0)
  const progres = await ambilRun(env, runId)

  return json({ ok: true, ...progres, ...(dipotong ? { dipotong } : {}) })
}
