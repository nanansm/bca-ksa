import type { Env as EnvDasar } from './auth'

/**
 * Pembungkus tipis di atas D1. Semua endpoint bicara lewat fungsi di sini supaya
 * bentuk baris tabel tidak bocor ke mana-mana — kalau skema berubah, cukup file ini.
 */
export interface Env extends EnvDasar {
  DB: D1Database
}

export type StatusRun =
  | 'menyiapkan' // sudah dikunci, n8n belum melapor
  | 'jalan'
  | 'selesai'
  | 'dihentikan' // rem darurat gagal beruntun
  | 'dihentikan_batas' // kena batas harian Meta
  | 'terputus' // tidak ada kabar > 15 menit
  | 'gagal_mulai' // n8n menolak setelah balasan dini

export interface Progres {
  runId: string
  status: StatusRun
  promo: string
  target: number // 0 selama masih 'menyiapkan'
  terkirim: number
  gagal: number
  tertahan: number // kena batas Meta, tamu TIDAK dianggap sudah dikirimi
  alasan: string // kosong kalau normal
  mulai: string // ISO
  diperbarui: string // ISO
}

/** Status yang menandakan run masih memegang kunci (kolom `aktif` = 1). */
const STATUS_AKTIF = new Set<StatusRun>(['menyiapkan', 'jalan'])

const LIMBO_MS = 15 * 60 * 1000

interface BarisRun {
  id: string
  status: StatusRun
  promo: string
  target: number
  terkirim: number
  gagal: number
  tertahan: number
  alasan: string
  mulai: string
  diperbarui: string
}

function keProgres(baris: BarisRun): Progres {
  return {
    runId: baris.id,
    status: baris.status,
    promo: baris.promo,
    target: baris.target,
    terkirim: baris.terkirim,
    gagal: baris.gagal,
    tertahan: baris.tertahan,
    alasan: baris.alasan,
    mulai: baris.mulai,
    diperbarui: baris.diperbarui,
  }
}

const KOLOM_RUN = 'id, status, promo, target, terkirim, gagal, tertahan, alasan, mulai, diperbarui'

export interface PromoBaris {
  template: string
  nama: string
  ringkas: string
  berlaku_sampai: string | null
  urut: number
}

/** Seluruh baris tabel promo, dipakai untuk menggabung dengan jawaban n8n. */
export async function ambilSemuaPromo(env: Env): Promise<PromoBaris[]> {
  const { results } = await env.DB.prepare(
    'SELECT template, nama, ringkas, berlaku_sampai, urut FROM promo',
  ).all<PromoBaris>()
  return results ?? []
}

/** Baris promo urut dari yang paling baru dibuat -- dipakai GET /api/promo-baru supaya
 * promo yang baru saja diajukan staf muncul paling atas. */
export async function ambilSemuaPromoTerbaru(env: Env): Promise<PromoBaris[]> {
  const { results } = await env.DB.prepare(
    'SELECT template, nama, ringkas, berlaku_sampai, urut FROM promo ORDER BY dibuat DESC',
  ).all<PromoBaris>()
  return results ?? []
}

/**
 * Menambah satu baris promo baru. WAJIB dipanggil SETELAH Meta menerima templatenya --
 * lihat KONTRAK-BUAT-PROMO.md: kalau Meta menolak, tabel ini tidak boleh ketambahan
 * baris yang templatenya tidak ada.
 */
export async function tambahPromo(
  env: Env,
  data: { template: string; nama: string; ringkas: string; berlakuSampai: string },
): Promise<void> {
  const terbesar = await env.DB.prepare('SELECT COALESCE(MAX(urut), 0) AS n FROM promo').first<{ n: number }>()
  const urut = (terbesar?.n ?? 0) + 1
  await env.DB.prepare(
    `INSERT INTO promo (template, nama, ringkas, berlaku_sampai, urut, dibuat) VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(data.template, data.nama, data.ringkas, data.berlakuSampai, urut, new Date().toISOString())
    .run()
}

/**
 * Mengunci satu run baru sebagai satu-satunya yang aktif. Gagal (indeks unik
 * `run_aktif_tunggal`) berarti sudah ada run lain yang sedang berjalan.
 */
export async function kunciRunBaru(
  env: Env,
  data: { id: string; promo: string; template: string; maks: number },
): Promise<{ ok: true } | { ok: false; aktif: Progres | null }> {
  const sekarang = new Date().toISOString()
  try {
    await env.DB.prepare(
      `INSERT INTO run (id, status, promo, template, maks, target, terkirim, gagal, tertahan, alasan, mulai, diperbarui, aktif)
       VALUES (?, 'menyiapkan', ?, ?, ?, 0, 0, 0, 0, '', ?, ?, 1)`,
    )
      .bind(data.id, data.promo, data.template, data.maks, sekarang, sekarang)
      .run()
    return { ok: true }
  } catch {
    // Indeks unik menolak baris kedua yang aktif — beri tahu pemanggil run mana yang sedang jalan.
    return { ok: false, aktif: await ambilRunAktif(env) }
  }
}

/**
 * Dipanggil setelah n8n menjawab OK. Dua penjaga di sini penting:
 *
 * 1. `WHERE status = 'menyiapkan'` — n8n membalas lebih dulu lalu terus bekerja, jadi run
 *    pendek (mode uji, satu penerima) bisa sudah dilaporkan 'selesai' sebelum baris ini
 *    dijalankan. Tanpa penjaga ini run yang sudah tutup dihidupkan lagi jadi 'jalan' dan
 *    kuncinya nyangkut 15 menit.
 * 2. Target hanya ditimpa kalau angkanya sungguhan. Balasan dini n8n membawa target 0,
 *    sedangkan angka aslinya menyusul lewat laporan `Lapor Target`, yang bisa mendarat
 *    lebih dulu.
 */
export async function tandaiJalan(env: Env, runId: string, target: number): Promise<void> {
  const sekarang = new Date().toISOString()
  if (target > 0) {
    await env.DB.prepare(
      `UPDATE run SET status = 'jalan', target = ?, aktif = 1, diperbarui = ?
       WHERE id = ? AND status = 'menyiapkan'`,
    )
      .bind(target, sekarang, runId)
      .run()
    return
  }
  await env.DB.prepare(
    `UPDATE run SET status = 'jalan', aktif = 1, diperbarui = ?
     WHERE id = ? AND status = 'menyiapkan'`,
  )
    .bind(sekarang, runId)
    .run()
}

/** Dipanggil saat panggilan n8n gagal: kunci dilepas supaya staf bisa coba lagi. */
export async function tandaiGagalMulai(env: Env, runId: string, alasan: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE run SET status = 'gagal_mulai', alasan = ?, aktif = NULL, diperbarui = ? WHERE id = ?`,
  )
    .bind(alasan, new Date().toISOString(), runId)
    .run()
}

export async function ambilRun(env: Env, runId: string): Promise<Progres | null> {
  const baris = await env.DB.prepare(`SELECT ${KOLOM_RUN} FROM run WHERE id = ?`)
    .bind(runId)
    .first<BarisRun>()
  return baris ? keProgres(baris) : null
}

/** Run yang sedang memegang kunci (status 'menyiapkan' atau 'jalan'), kalau ada. */
export async function ambilRunAktif(env: Env): Promise<Progres | null> {
  const baris = await env.DB.prepare(`SELECT ${KOLOM_RUN} FROM run WHERE aktif = 1 LIMIT 1`).first<BarisRun>()
  return baris ? keProgres(baris) : null
}

/**
 * Menutup run yang tidak ada kabar > 15 menit sebagai 'terputus'. Dipanggil di awal
 * GET /api/run-aktif supaya kunci tidak nyangkut selamanya kalau n8n mati di tengah jalan.
 */
export async function tandaiTerputusJikaBasi(env: Env): Promise<void> {
  const batas = new Date(Date.now() - LIMBO_MS).toISOString()
  await env.DB.prepare(
    `UPDATE run SET status = 'terputus', aktif = NULL, diperbarui = ?
     WHERE aktif = 1 AND diperbarui < ?`,
  )
    .bind(new Date().toISOString(), batas)
    .run()
}

export type LaporanCallback =
  | { status: 'jalan'; terkirimBatch: number; gagalBatch: number; tertahanBatch: number; target?: number }
  | { status: 'selesai'; terkirim: number; gagal: number; tertahan: number }
  | { status: 'dihentikan' | 'dihentikan_batas' | 'gagal_mulai'; alasan: string }

/**
 * Menerapkan satu laporan dari n8n ke baris run. Status penutup ('selesai',
 * 'dihentikan', 'dihentikan_batas', 'gagal_mulai') melepas kunci (`aktif = NULL`).
 */
export async function terapkanLaporan(env: Env, runId: string, laporan: LaporanCallback): Promise<void> {
  const sekarang = new Date().toISOString()

  if (laporan.status === 'jalan') {
    if (typeof laporan.target === 'number') {
      await env.DB.prepare(
        `UPDATE run SET terkirim = terkirim + ?, gagal = gagal + ?, tertahan = tertahan + ?, target = ?, diperbarui = ? WHERE id = ?`,
      )
        .bind(laporan.terkirimBatch, laporan.gagalBatch, laporan.tertahanBatch, laporan.target, sekarang, runId)
        .run()
    } else {
      await env.DB.prepare(
        `UPDATE run SET terkirim = terkirim + ?, gagal = gagal + ?, tertahan = tertahan + ?, diperbarui = ? WHERE id = ?`,
      )
        .bind(laporan.terkirimBatch, laporan.gagalBatch, laporan.tertahanBatch, sekarang, runId)
        .run()
    }
    return
  }

  if (laporan.status === 'selesai') {
    await env.DB.prepare(
      `UPDATE run SET status = 'selesai', terkirim = ?, gagal = ?, tertahan = ?, aktif = NULL, diperbarui = ? WHERE id = ?`,
    )
      .bind(laporan.terkirim, laporan.gagal, laporan.tertahan, sekarang, runId)
      .run()
    return
  }

  await env.DB.prepare(
    `UPDATE run SET status = ?, alasan = ?, aktif = NULL, diperbarui = ? WHERE id = ?`,
  )
    .bind(laporan.status, laporan.alasan, sekarang, runId)
    .run()
}

/** Run terbaru, dipakai `run_terakhir` di /api/dashboard. Urut mulai menurun. */
export async function ambilRunTerakhir(env: Env, limit: number): Promise<Progres[]> {
  const { results } = await env.DB.prepare(`SELECT ${KOLOM_RUN} FROM run ORDER BY mulai DESC LIMIT ?`)
    .bind(limit)
    .all<BarisRun>()
  return (results ?? []).map(keProgres)
}

/** Jumlah pesan terkirim dari semua run yang mulai dalam 24 jam terakhir — dasar sisa kuota harian. */
export async function hitungTerpakai24Jam(env: Env): Promise<number> {
  const batas = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const baris = await env.DB.prepare(
    `SELECT COALESCE(SUM(terkirim), 0) AS total FROM run WHERE mulai >= ?`,
  )
    .bind(batas)
    .first<{ total: number }>()
  return baris?.total ?? 0
}

export const statusAktif = (status: StatusRun): boolean => STATUS_AKTIF.has(status)

/**
 * Jumlah pesan broadcast yang benar-benar terkirim sejak awal bulan Jakarta. Dipakai untuk
 * perkiraan biaya di dashboard. Sengaja TIDAK memakai angka `sent` dari Meta: angka Meta
 * mencakup semua percakapan nomor ini termasuk balasan CS, sedangkan yang ditagih sebagai
 * pesan marketing cuma yang dikirim lewat broadcast.
 */
export async function terkirimSejak(env: Env, mulaiIso: string): Promise<number> {
  const baris = await env.DB.prepare(`SELECT COALESCE(SUM(terkirim), 0) AS n FROM run WHERE mulai >= ?`)
    .bind(mulaiIso)
    .first<{ n: number }>()
  return baris?.n ?? 0
}

export interface DaftarRingkas {
  id: string
  nama: string
  periode: string
  checkout_terakhir: string | null
  jumlah: number
  dibuat: string
}

/** Bikin baris daftar baru, `siap = 0` sampai unggahan selesai (lihat KONTRAK-DAFTAR-TAMU.md). */
export async function buatDaftar(
  env: Env,
  data: { id: string; nama: string; periode: string; checkoutTerakhir: string | null },
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO daftar (id, nama, periode, checkout_terakhir, jumlah, siap, dibuat) VALUES (?, ?, ?, ?, 0, 0, ?)`,
  )
    .bind(data.id, data.nama, data.periode, data.checkoutTerakhir, new Date().toISOString())
    .run()
}

/** Cuma kolom yang dibutuhkan buat memeriksa kunci sebelum menambah nomor. */
export async function ambilStatusDaftar(env: Env, id: string): Promise<{ siap: number } | null> {
  return await env.DB.prepare('SELECT siap FROM daftar WHERE id = ?').bind(id).first<{ siap: number }>()
}

/**
 * Tulis satu potongan nomor. Dipecah maksimal 25 baris per pernyataan (75 parameter,
 * di bawah batas 100 D1) dan maksimal 20 pernyataan per `env.DB.batch()` -- lihat
 * KONTRAK-DAFTAR-TAMU.md.
 */
export async function tambahNomorDaftar(
  env: Env,
  daftarId: string,
  nomor: { nomor: string; nama: string }[],
): Promise<void> {
  const BARIS_PER_PERNYATAAN = 25
  const PERNYATAAN_PER_BATCH = 20

  const pernyataan: D1PreparedStatement[] = []
  for (let i = 0; i < nomor.length; i += BARIS_PER_PERNYATAAN) {
    const potongan = nomor.slice(i, i + BARIS_PER_PERNYATAAN)
    const placeholder = potongan.map(() => '(?,?,?)').join(',')
    const nilai = potongan.flatMap((n) => [daftarId, n.nomor, n.nama])
    pernyataan.push(
      env.DB.prepare(`INSERT OR IGNORE INTO daftar_nomor (daftar_id, nomor, nama) VALUES ${placeholder}`).bind(
        ...nilai,
      ),
    )
  }

  for (let i = 0; i < pernyataan.length; i += PERNYATAAN_PER_BATCH) {
    await env.DB.batch(pernyataan.slice(i, i + PERNYATAAN_PER_BATCH))
  }
}

/**
 * Mengunci daftar: `siap` cuma ditulis 1 lewat pernyataan ini (persis kontrak), lalu
 * jumlah sungguhan diperiksa terpisah -- kalau 0, baris yang baru saja dikunci dihapus
 * lagi supaya daftar kosong tidak pernah muncul sebagai pilihan penerima.
 */
export async function selesaikanDaftar(env: Env, id: string): Promise<number> {
  await env.DB.prepare(
    `UPDATE daftar SET jumlah = (SELECT COUNT(*) FROM daftar_nomor WHERE daftar_id = ?), siap = 1 WHERE id = ?`,
  )
    .bind(id, id)
    .run()

  const baris = await env.DB.prepare('SELECT jumlah FROM daftar WHERE id = ?').bind(id).first<{ jumlah: number }>()
  const jumlah = baris?.jumlah ?? 0
  if (jumlah === 0) await hapusDaftar(env, id)
  return jumlah
}

/** Daftar yang siap dipakai (`siap = 1`), terbaru dulu -- buat pemilih penerima Kirim Promo. */
export async function ambilDaftarSiap(env: Env): Promise<DaftarRingkas[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, nama, periode, checkout_terakhir, jumlah, dibuat FROM daftar WHERE siap = 1 ORDER BY dibuat DESC`,
  ).all<DaftarRingkas>()
  return results ?? []
}

export async function hapusDaftar(env: Env, id: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM daftar_nomor WHERE daftar_id = ?').bind(id),
    env.DB.prepare('DELETE FROM daftar WHERE id = ?').bind(id),
  ])
}

export interface DaftarNomorHasil {
  nama: string
  nomor: { nomor: string; nama: string }[]
}

/** Nama daftar + seluruh nomornya, dipakai MESIN (n8n) lewat X-BC-Secret. `null` = tidak ketemu. */
export async function ambilNomorDaftar(env: Env, id: string): Promise<DaftarNomorHasil | null> {
  const daftar = await env.DB.prepare('SELECT nama FROM daftar WHERE id = ? AND siap = 1')
    .bind(id)
    .first<{ nama: string }>()
  if (!daftar) return null

  const { results } = await env.DB.prepare('SELECT nomor, nama FROM daftar_nomor WHERE daftar_id = ?')
    .bind(id)
    .all<{ nomor: string; nama: string }>()
  return { nama: daftar.nama, nomor: results ?? [] }
}
