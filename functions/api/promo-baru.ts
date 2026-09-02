import { json } from '../_lib/auth'
import { ambilSemuaPromoTerbaru, tambahPromo, type Env } from '../_lib/db'
import { buatTemplate, daftarNamaTemplate, MetaTemplateError, type KomponenTemplate } from '../_lib/meta'

interface TombolValid {
  tipe: 'situs' | 'balasan'
  teks: string
  url: string
}

interface PromoValid {
  nama: string
  ringkas: string
  isi: string
  footer: string
  tombol: TombolValid
  berlakuSampai: string
}

/** Tanggal hari ini di zona Asia/Jakarta, format YYYY-MM-DD -- perbandingan string langsung sah untuk format ini. */
function hariIniJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

/**
 * Validasi persis urutan tabel di KONTRAK-BUAT-PROMO.md, balas di pelanggaran PERTAMA.
 * Staf hotel yang membaca error ini, jadi kalimatnya harus utuh dan tanpa istilah Meta.
 */
function validasi(body: Record<string, unknown>): PromoValid | { error: string } {
  const nama = String(body.nama ?? '').trim()
  if (nama.length < 3) return { error: 'Nama promo terlalu pendek.' }
  if (nama.length > 60) return { error: 'Nama promo terlalu panjang, maksimal 60 huruf.' }

  const ringkas = String(body.ringkas ?? '').trim()
  if (ringkas.length > 120) return { error: 'Keterangan singkat maksimal 120 huruf.' }

  const isi = String(body.isi ?? '').trim()
  if (isi.length < 30) return { error: 'Isi pesan terlalu pendek.' }
  if (isi.length > 1024) return { error: 'Isi pesan maksimal 1.024 huruf.' }
  if (isi.includes('{{') || isi.includes('}}')) {
    return { error: 'Isi pesan tidak boleh memakai tanda {{ }}. Tulis kalimatnya lengkap.' }
  }

  const footer = String(body.footer ?? '').trim()
  if (footer.length > 60) return { error: 'Footer maksimal 60 huruf.' }

  const tombolMentah = (body.tombol && typeof body.tombol === 'object' ? body.tombol : {}) as {
    tipe?: unknown
    teks?: unknown
    url?: unknown
  }
  // Bentuk body cuma dijaga di tipe TS sisi klien -- runtime tetap JSON bebas, jadi
  // tipe tombol yang tak dikenal harus ditolak duluan sebelum dibaca lebih jauh.
  const tipeTombol = tombolMentah.tipe === 'situs' || tombolMentah.tipe === 'balasan' ? tombolMentah.tipe : null
  if (!tipeTombol) return { error: 'Jenis tombol tidak dikenali.' }

  const teksTombol = String(tombolMentah.teks ?? '').trim()
  if (teksTombol.length < 1 || teksTombol.length > 25) {
    return { error: 'Tulisan tombol wajib diisi, maksimal 25 huruf.' }
  }

  const urlTombol = String(tombolMentah.url ?? '').trim()
  if (tipeTombol === 'situs') {
    if (!urlTombol.startsWith('https://')) return { error: 'Link tombol harus diawali https://' }
    if (urlTombol.includes('wa.me') || urlTombol.includes('api.whatsapp.com')) {
      return {
        error:
          'WhatsApp tidak mengizinkan link wa.me dipakai sebagai tombol. Pakai link website, atau ganti tombolnya jadi tombol balasan.',
      }
    }
  }

  const berlakuSampai = String(body.berlaku_sampai ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(berlakuSampai) || berlakuSampai < hariIniJakarta()) {
    return { error: 'Masa berlaku wajib diisi, dan tidak boleh tanggal yang sudah lewat.' }
  }

  return {
    nama,
    ringkas,
    isi,
    footer,
    tombol: { tipe: tipeTombol, teks: teksTombol, url: tipeTombol === 'situs' ? urlTombol : '' },
    berlakuSampai,
  }
}

/**
 * Nama template Meta: huruf kecil, non-alfanumerik jadi `_`, garis bawah beruntun
 * dipadatkan, dipangkas di ujung, maksimal 60 karakter. Staf tidak pernah mengetiknya --
 * digenerate dari nama yang mereka isi.
 */
function buatDasarNama(nama: string): string {
  let dasar = nama
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  if (dasar.length > 60) dasar = dasar.slice(0, 60).replace(/_$/, '')
  return dasar || 'promo'
}

/** Tambah `_2`, `_3`, ... sampai tidak bentrok nama yang sudah dipakai di Meta. */
function namaBebasBentrok(dasar: string, terpakai: Set<string>): string {
  if (!terpakai.has(dasar)) return dasar
  for (let i = 2; i < 1000; i++) {
    const akhiran = `_${i}`
    const kandidat = `${dasar.slice(0, Math.max(1, 60 - akhiran.length))}${akhiran}`
    if (!terpakai.has(kandidat)) return kandidat
  }
  // Praktis tidak pernah kejadian -- 1000 promo dengan nama dasar sama persis.
  return `${dasar.slice(0, 40)}_${crypto.randomUUID().slice(0, 8)}`
}

/**
 * Urutan wajib, JANGAN dibalik (lihat KONTRAK-BUAT-PROMO.md): ajukan ke Meta dulu,
 * baru tulis D1. Tidak ada notifikasi ke Moté -- validasi di sini satu-satunya pengaman
 * sebelum template langsung diajukan ke Meta.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return json({ error: 'Permintaan tidak terbaca.' }, { status: 400 })
  }

  const promo = validasi(body)
  if ('error' in promo) return json({ error: promo.error }, { status: 400 })

  let daftar: { name: string; status: string }[]
  try {
    daftar = await daftarNamaTemplate(env)
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : 'Gagal memeriksa nama promo ke WhatsApp.' },
      { status: 502 },
    )
  }
  // Nama dibandingkan ke Meta DAN ke D1: `promo.template` itu PRIMARY KEY, jadi nama
  // yang sudah tercatat di D1 tapi templatenya keburu dihapus di Meta akan lolos cek
  // Meta lalu gagal di INSERT -- sesudah templatenya terlanjur dibuat di Meta.
  const terpakai = new Set(daftar.map((t) => t.name))
  for (const p of await ambilSemuaPromoTerbaru(env)) terpakai.add(p.template)
  const namaTemplate = namaBebasBentrok(buatDasarNama(promo.nama), terpakai)

  const komponen: KomponenTemplate[] = [{ type: 'BODY', text: promo.isi }]
  if (promo.footer) komponen.push({ type: 'FOOTER', text: promo.footer })
  komponen.push({
    type: 'BUTTONS',
    buttons:
      promo.tombol.tipe === 'situs'
        ? [{ type: 'URL', text: promo.tombol.teks, url: promo.tombol.url }]
        : [{ type: 'QUICK_REPLY', text: promo.tombol.teks }],
  })

  let template: { id: string; status: string; category: string }
  try {
    template = await buatTemplate(env, { name: namaTemplate, components: komponen })
  } catch (err) {
    if (err instanceof MetaTemplateError) {
      return json({ error: err.pesanStaf || err.message }, { status: 400 })
    }
    return json({ error: err instanceof Error ? err.message : 'WhatsApp menolak promo ini.' }, { status: 400 })
  }

  await tambahPromo(env, {
    template: namaTemplate,
    nama: promo.nama,
    ringkas: promo.ringkas,
    berlakuSampai: promo.berlakuSampai,
  })

  return json({ ok: true, template: namaTemplate, status: template.status })
}

/** Daftar promo yang tercatat di D1 beserta status Meta-nya, buat layar Buat Promo. */
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const promoTersimpan = await ambilSemuaPromoTerbaru(env)

  let petaStatus = new Map<string, string>()
  try {
    const daftar = await daftarNamaTemplate(env)
    petaStatus = new Map(daftar.map((t) => [t.name, t.status]))
  } catch {
    // Meta gagal dijawab -- tetap sajikan daftar promo dari D1, status kosong lebih
    // baik daripada halaman kosong.
  }

  const promos = promoTersimpan.map((p) => ({
    template: p.template,
    nama: p.nama,
    ringkas: p.ringkas,
    berlaku_sampai: p.berlaku_sampai,
    status: petaStatus.get(p.template) ?? '',
  }))

  return json({ ok: true, promos })
}
