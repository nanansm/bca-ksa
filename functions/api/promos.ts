import { json } from '../_lib/auth'
import { callN8n } from '../_lib/n8n'
import { ambilSemuaPromo, type Env } from '../_lib/db'

/** Bentuk satu template seperti dikirim n8n (asal dari WhatsApp Business Manager). */
interface PromoN8n {
  template: string
  status: string
  isi_pesan: string
  footer: string
  butuh_gambar: boolean
  gambar_url: string
  tombol: { teks: string; tipe: string }[]
  bisa_dikirim: boolean
  alasan_tak_bisa: string
}

interface PromoTampil extends PromoN8n {
  nama: string
  ringkas: string
  urut: number
  berlaku_sampai: string | null
}

/** Tanggal hari ini di zona Asia/Jakarta, format YYYY-MM-DD — perbandingan string langsung sah untuk format ini. */
function hariIniJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  let dariN8n: PromoN8n[]
  try {
    const data = await callN8n<{ promos: PromoN8n[] }>(env, 'ksa-bc-promos', {}, 30_000)
    dariN8n = data.promos ?? []
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : 'Gagal mengambil daftar promo.' },
      { status: 502 },
    )
  }

  const daftarPromo = await ambilSemuaPromo(env)
  const petaPromo = new Map(daftarPromo.map((baris) => [baris.template, baris]))
  const hariIni = hariIniJakarta()

  const promos: PromoTampil[] = []
  for (const promo of dariN8n) {
    if (promo.status !== 'APPROVED') continue

    const baris = petaPromo.get(promo.template)
    if (!baris) continue // belum didaftarkan tim Mote di tabel promo — jangan tampilkan sembarangan

    if (baris.berlaku_sampai && baris.berlaku_sampai < hariIni) continue // sudah lewat tanggal berlaku

    promos.push({
      ...promo,
      nama: baris.nama,
      ringkas: baris.ringkas,
      urut: baris.urut,
      berlaku_sampai: baris.berlaku_sampai,
    })
  }

  promos.sort((a, b) => a.urut - b.urut)

  return json({ ok: true, promos })
}
