import type { Env } from './auth'

/**
 * Pembungkus Graph API WhatsApp Business. Semua hasil di-cache di KV `BC_STATE`
 * 10 menit (awalan kunci `cache:meta:`) supaya dashboard tidak menembak Meta tiap
 * dibuka. `messaging_limit_tier` dan `conversation_analytics` sengaja TIDAK diminta --
 * keduanya terbukti di-drop diam-diam oleh Graph untuk token ini di semua versi API.
 */

const VERSI = 'v21.0'
const CACHE_TTL_DETIK = 10 * 60
const CACHE_PREFIX = 'cache:meta:'
const JAKARTA_OFFSET_DETIK = 7 * 60 * 60

export type HasilMeta<T> = { ok: true; data: T } | { ok: false; sebab: string }

export interface AnalitikHarian {
  tanggal: string // 'YYYY-MM-DD'
  terkirim: number
  sampai: number
}

export interface KesehatanNomor {
  display: string
  kualitas: string
  status: string
}

/**
 * Cache-aside sederhana: kalau ada di KV pakai itu, kalau tidak tembak Meta lalu
 * simpan. Kegagalan Meta jangan sampai memecahkan halaman -- kembalikan penanda
 * gagal supaya pemanggil bisa menyajikan bagian lain dashboard yang berhasil.
 */
async function ambilTercache<T>(env: Env, kunci: string, ambil: () => Promise<T>): Promise<HasilMeta<T>> {
  const kunciCache = `${CACHE_PREFIX}${kunci}`
  const tersimpan = await env.BC_STATE.get(kunciCache)
  if (tersimpan) {
    try {
      return { ok: true, data: JSON.parse(tersimpan) as T }
    } catch {
      // cache rusak -- lanjut tembak Meta di bawah
    }
  }

  try {
    const data = await ambil()
    await env.BC_STATE.put(kunciCache, JSON.stringify(data), { expirationTtl: CACHE_TTL_DETIK })
    return { ok: true, data }
  } catch (e) {
    // Sebab dibawa keluar supaya dashboard bisa bilang APA yang gagal, bukan cuma
    // "tidak bisa diambil". Pesannya tidak pernah memuat token -- lihat panggilGraph.
    return { ok: false, sebab: e instanceof Error ? e.message : 'gagal tanpa keterangan' }
  }
}

async function panggilGraph<T>(env: Env, id: string, fields: string, tambahan?: Record<string, string>): Promise<T> {
  if (!env.META_TOKEN) throw new Error('META_TOKEN belum dipasang di Pages')
  if (!id) throw new Error('id Meta kosong (META_WABA_ID / META_PHONE_ID belum dipasang)')

  const url = new URL(`https://graph.facebook.com/${VERSI}/${id}`)
  url.searchParams.set('fields', fields)
  for (const [k, v] of Object.entries(tambahan ?? {})) url.searchParams.set(k, v)
  url.searchParams.set('access_token', env.META_TOKEN)

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) {
    // Badan balasan Meta memuat kode & pesan errornya, tidak memuat token.
    const badan = await res.text().catch(() => '')
    throw new Error(`Meta balas ${res.status}: ${badan.slice(0, 200)}`)
  }
  return (await res.json()) as T
}

interface ErrorGraph {
  error?: { message?: string; error_user_msg?: string; error_user_title?: string; error_subcode?: number }
}

/** Error dari POST /message_templates. `pesanStaf` dipilih pemanggil dari `error_user_msg`
 * Meta (kalimat manusiawi) kalau ada, baru jatuh ke `message` mentah. */
export class MetaTemplateError extends Error {
  pesanStaf?: string
  constructor(message: string, pesanStaf?: string) {
    super(message)
    this.pesanStaf = pesanStaf
  }
}

/** POST ke Graph API. Jalur terpisah dari panggilGraph (GET) supaya yang GET tidak
 * ikut berubah -- lihat kontrak: "Bikin jalur POST terpisah, jangan rusak yang GET." */
async function panggilGraphPost<T>(env: Env, id: string, body: unknown): Promise<T> {
  if (!env.META_TOKEN) throw new Error('META_TOKEN belum dipasang di Pages')
  if (!id) throw new Error('id Meta kosong (META_WABA_ID belum dipasang)')

  const url = new URL(`https://graph.facebook.com/${VERSI}/${id}`)
  url.searchParams.set('access_token', env.META_TOKEN)

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })

  const teks = await res.text()
  let terurai: unknown = null
  try {
    terurai = teks ? JSON.parse(teks) : null
  } catch {
    // biarkan null -- ditangani lewat status HTTP di bawah
  }

  if (!res.ok) {
    const err = (terurai as ErrorGraph | null)?.error
    throw new MetaTemplateError(err?.message || `Meta balas ${res.status}`, err?.error_user_msg)
  }
  return terurai as T
}

export interface KomponenTombol {
  type: 'URL' | 'QUICK_REPLY'
  text: string
  url?: string
}

export interface KomponenTemplate {
  type: 'BODY' | 'FOOTER' | 'BUTTONS'
  text?: string
  buttons?: KomponenTombol[]
}

export interface NamaTemplateMeta {
  name: string
  status: string
}

interface ResponDaftarTemplate {
  data?: NamaTemplateMeta[]
}

/**
 * GET /{WABA}/message_templates?fields=name,status -- dipakai buat cek bentrok nama
 * dan status terbaru di layar Buat Promo. SENGAJA TIDAK lewat ambilTercache: cache
 * 10 menit membuat template yang baru saja diajukan staf lain tidak kelihatan bentrok,
 * dan status yang ditampilkan jadi basi.
 */
export async function daftarNamaTemplate(env: Env): Promise<NamaTemplateMeta[]> {
  // Dicek di sini, bukan cuma di panggilGraph: begitu id disambung jadi
  // `${id}/message_templates`, string kosong berubah jadi truthy dan lolos penjagaan.
  if (!env.META_WABA_ID) throw new Error('META_WABA_ID belum dipasang di Pages')
  const data = await panggilGraph<ResponDaftarTemplate>(
    env,
    `${env.META_WABA_ID}/message_templates`,
    'name,status',
    { limit: '500' },
  )
  return data.data ?? []
}

export interface HasilBuatTemplate {
  id: string
  status: string
  category: string
}

/**
 * POST /{WABA}/message_templates. `language` dan `category` dikunci di sini, bukan
 * parameter -- kontrak cuma butuh template MARKETING berbahasa Indonesia, mengunci
 * keduanya mencegah staf lain menambah pilihan yang belum ada validasinya.
 */
export async function buatTemplate(
  env: Env,
  data: { name: string; components: KomponenTemplate[] },
): Promise<HasilBuatTemplate> {
  if (!env.META_WABA_ID) throw new Error('META_WABA_ID belum dipasang di Pages')
  return panggilGraphPost<HasilBuatTemplate>(env, `${env.META_WABA_ID}/message_templates`, {
    name: data.name,
    language: 'id',
    category: 'MARKETING',
    components: data.components,
  })
}

/** Epoch detik pembulatan hari -- kunci cache stabil sepanjang hari yang sama. */
function epochDetik(tanggal: Date): number {
  return Math.floor(tanggal.getTime() / 1000)
}

interface ResponAnalytics {
  analytics?: { data_points?: { start: number; sent?: number; delivered?: number }[] }
}

/** GET /{WABA}?fields=analytics.start(...).end(...).granularity(DAY) */
export async function analitikHarian(env: Env, mulai: Date, selesai: Date): Promise<HasilMeta<AnalitikHarian[]>> {
  const kunci = `analytics:${mulai.toISOString().slice(0, 10)}:${selesai.toISOString().slice(0, 10)}`
  return ambilTercache(env, kunci, async () => {
    const fields = `analytics.start(${epochDetik(mulai)}).end(${epochDetik(selesai)}).granularity(DAY)`
    const data = await panggilGraph<ResponAnalytics>(env, env.META_WABA_ID, fields)
    const titik = data.analytics?.data_points ?? []
    // Meta memotong hari menurut zona waktu nomornya, jadi `start` jatuh pada 17.00 UTC
    // (00.00 WIB). Tanpa menggeser +7 jam, `toISOString()` memberi tanggal sehari mundur.
    return titik.map((t) => ({
      tanggal: new Date((t.start + JAKARTA_OFFSET_DETIK) * 1000).toISOString().slice(0, 10),
      terkirim: t.sent ?? 0,
      sampai: t.delivered ?? 0,
    }))
  })
}

interface ResponPricing {
  pricing_analytics?: {
    data?: { data_points?: { start: number; volume?: number; cost?: number }[] }[]
  }
}

export interface BiayaHarian {
  tanggal: string // 'YYYY-MM-DD'
  jumlah: number // pesan berbayar
  biaya: number // rupiah, sudah dijumlah semua kategori harga hari itu
}

/**
 * GET /{WABA}?fields=pricing_analytics... — biaya SEBENARNYA yang ditagih Meta, bukan
 * perkiraan tarif x jumlah. Angka ini yang sama dengan "Approximate charges" di
 * WhatsApp Manager. Satu hari bisa punya beberapa data point (kategori harga berbeda),
 * jadi dijumlahkan per tanggal.
 */
export async function biayaHarian(env: Env, mulai: Date, selesai: Date): Promise<HasilMeta<BiayaHarian[]>> {
  const kunci = `biaya:${mulai.toISOString().slice(0, 10)}:${selesai.toISOString().slice(0, 10)}`
  return ambilTercache(env, kunci, async () => {
    const fields =
      `pricing_analytics.start(${epochDetik(mulai)}).end(${epochDetik(selesai)})` +
      `.granularity(DAILY).dimensions(['PRICING_CATEGORY'])`
    const data = await panggilGraph<ResponPricing>(env, env.META_WABA_ID, fields)

    const perTanggal = new Map<string, BiayaHarian>()
    for (const kelompok of data.pricing_analytics?.data ?? []) {
      for (const t of kelompok.data_points ?? []) {
        const tanggal = new Date((t.start + JAKARTA_OFFSET_DETIK) * 1000).toISOString().slice(0, 10)
        const ada = perTanggal.get(tanggal) ?? { tanggal, jumlah: 0, biaya: 0 }
        ada.jumlah += t.volume ?? 0
        ada.biaya += t.cost ?? 0
        perTanggal.set(tanggal, ada)
      }
    }
    return [...perTanggal.values()].sort((a, b) => a.tanggal.localeCompare(b.tanggal))
  })
}

interface ResponNomor {
  display_phone_number: string
  quality_rating: string
  status: string
}

/** GET /{PHONE_ID}?fields=display_phone_number,quality_rating,status */
export async function kesehatanNomor(env: Env): Promise<HasilMeta<KesehatanNomor>> {
  return ambilTercache(env, 'nomor', async () => {
    const data = await panggilGraph<ResponNomor>(env, env.META_PHONE_ID, 'display_phone_number,quality_rating,status')
    return { display: data.display_phone_number, kualitas: data.quality_rating, status: data.status }
  })
}
