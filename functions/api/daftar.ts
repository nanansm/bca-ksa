import { json } from '../_lib/auth'
import {
  ambilDaftarSiap,
  ambilStatusDaftar,
  buatDaftar,
  hapusDaftar,
  selesaikanDaftar,
  tambahNomorDaftar,
  type Env,
} from '../_lib/db'
import { norm } from '../../src/lib/nomor'

// Diminta browser lewat sesi login staf. Unggahan dipecah tiga aksi (mulai/tambah/selesai)
// supaya 12 ribu nomor tidak pernah lewat dalam satu request -- lihat KONTRAK-DAFTAR-TAMU.md.
const MAKS_NOMOR_PER_PANGGILAN = 500

interface DaftarBaruValid {
  nama: string
  periode: string
  checkoutTerakhir: string | null
}

/** Validasi berurutan sesuai tabel di KONTRAK-DAFTAR-TAMU.md, balas di pelanggaran PERTAMA. */
function validasiMulai(body: Record<string, unknown>): DaftarBaruValid | { error: string } {
  const nama = String(body.nama ?? '').trim()
  if (nama.length < 3) return { error: 'Nama daftar terlalu pendek.' }
  if (nama.length > 60) return { error: 'Nama daftar terlalu panjang, maksimal 60 huruf.' }

  const periode = String(body.periode ?? '').trim()
  if (!periode) return { error: 'Periode menginap wajib diisi.' }
  if (periode.length > 60) return { error: 'Periode menginap maksimal 60 huruf.' }

  const checkoutMentah = String(body.checkout_terakhir ?? '').trim()
  let checkoutTerakhir: string | null = null
  if (checkoutMentah) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkoutMentah)) {
      return { error: 'Tanggal check-out terakhir tidak terbaca.' }
    }
    checkoutTerakhir = checkoutMentah
  }

  return { nama, periode, checkoutTerakhir }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return json({ error: 'Permintaan tidak terbaca.' }, { status: 400 })
  }

  const aksi = String(body.aksi ?? '')

  if (aksi === 'mulai') {
    const valid = validasiMulai(body)
    if ('error' in valid) return json({ error: valid.error }, { status: 400 })

    const id = crypto.randomUUID()
    await buatDaftar(env, { id, ...valid })
    return json({ ok: true, id })
  }

  if (aksi === 'tambah') {
    const id = String(body.id ?? '')
    const nomorMentah = Array.isArray(body.nomor) ? body.nomor : []
    if (nomorMentah.length > MAKS_NOMOR_PER_PANGGILAN) {
      return json({ error: 'Potongan terlalu besar.' }, { status: 400 })
    }

    const status = await ambilStatusDaftar(env, id)
    if (!status || status.siap === 1) {
      return json({ error: 'Daftar ini sudah dikunci.' }, { status: 400 })
    }

    // Nomor dijalankan ulang lewat norm() -- browser sudah menyaring, ini cuma jaring
    // pengaman, jadi yang gagal DIBUANG diam-diam, bukan bikin error.
    const bersih: { nomor: string; nama: string }[] = []
    for (const item of nomorMentah as { nomor?: unknown; nama?: unknown }[]) {
      const n = norm(item?.nomor)
      if (n) bersih.push({ nomor: n, nama: String(item?.nama ?? '').trim() })
    }
    if (bersih.length > 0) await tambahNomorDaftar(env, id, bersih)

    return json({ ok: true })
  }

  if (aksi === 'selesai') {
    const id = String(body.id ?? '')
    const jumlah = await selesaikanDaftar(env, id)
    if (jumlah === 0) {
      return json({ error: 'Tidak ada satu pun nomor yang bisa dipakai dari file ini.' }, { status: 400 })
    }
    return json({ ok: true, jumlah })
  }

  return json({ error: 'Aksi tidak dikenali.' }, { status: 400 })
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const daftar = await ambilDaftarSiap(env)
  return json({ ok: true, daftar })
}

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const id = new URL(request.url).searchParams.get('id') ?? ''
  if (!id) return json({ error: 'ID daftar wajib diisi.' }, { status: 400 })
  await hapusDaftar(env, id)
  return json({ ok: true })
}
