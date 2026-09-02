import type { Env } from './db'

/**
 * Akses tabel `pesan`. Lihat migrations/0001_awal.sql untuk kolomnya dan
 * KONTRAK-TAHAP-2.md untuk aturan status. Status hanya boleh maju:
 * `terkirim` < `sampai` < `dibaca`, dan `gagal` menang atas semuanya (begitu
 * `gagal` tersimpan, tidak ada status lain yang boleh menimpanya lagi).
 */

const MAKS_BARIS_TULIS_BALIK = 2000

/** Urutan maju status, dipakai untuk membandingkan status lama vs status baru. */
const URUTAN: Record<string, number> = { terkirim: 1, sampai: 2, dibaca: 3 }

/** Istilah Meta -> istilah tabel kita. */
const PETA_STATUS: Record<string, string> = {
  sent: 'terkirim',
  delivered: 'sampai',
  read: 'dibaca',
  failed: 'gagal',
}

export interface PesanKirim {
  wamid: string
  nomor: string
}

export interface StatusMeta {
  id: string
  status: string
  timestamp?: string
  recipient_id?: string
  pricing?: { billable?: boolean; category?: string }
  errors?: { code: number; title: string }[]
}

export interface PesanPerubahan {
  wamid: string
  nomor: string
  run_id: string
  status_terakhir: string
  billable: number | null
  diperbarui: string
}

/**
 * Simpan daftar {wamid,nomor} satu kelompok kirim. `INSERT OR IGNORE` supaya kiriman
 * ulang (n8n retry) tidak menggandakan baris -- wamid adalah primary key.
 */
export async function simpanDaftarPesan(env: Env, runId: string, pesan: PesanKirim[]): Promise<void> {
  if (pesan.length === 0) return
  const sekarang = new Date().toISOString()
  const pernyataan = pesan.map((p) =>
    env.DB.prepare(
      `INSERT OR IGNORE INTO pesan (wamid, run_id, nomor, status_terakhir, diperbarui)
       VALUES (?, ?, ?, 'terkirim', ?)`,
    ).bind(p.wamid, runId, p.nomor, sekarang),
  )
  await env.DB.batch(pernyataan)
  await serapStatusMenunggu(env, pesan.map((p) => p.wamid))
}

/**
 * Ambil status yang sempat tiba sebelum barisnya ada, terapkan, lalu buang.
 * Tanpa ini status delivered/read hilang permanen untuk hampir semua pesan: webhook Meta
 * tiba beberapa detik lebih dulu daripada laporan wamid dari n8n.
 */
async function serapStatusMenunggu(env: Env, wamids: string[]): Promise<void> {
  if (wamids.length === 0) return
  const placeholder = wamids.map(() => '?').join(',')
  const { results } = await env.DB.prepare(
    `SELECT wamid, status, billable FROM status_menunggu WHERE wamid IN (${placeholder})`,
  )
    .bind(...wamids)
    .all<{ wamid: string; status: string; billable: number | null }>()

  const menunggu = results ?? []
  if (menunggu.length === 0) return

  const sekarang = new Date().toISOString()
  const pernyataan = menunggu.map((m) =>
    env.DB.prepare(
      `UPDATE pesan SET status_terakhir = ?, billable = COALESCE(?, billable), diperbarui = ?
       WHERE wamid = ?`,
    ).bind(m.status, m.billable, sekarang, m.wamid),
  )
  pernyataan.push(
    env.DB.prepare(`DELETE FROM status_menunggu WHERE wamid IN (${placeholder})`).bind(...wamids),
  )
  await env.DB.batch(pernyataan)
}

/**
 * Simpan status yang wamid-nya belum dikenal. Tetap tunduk aturan urutan: yang tersimpan
 * cuma status paling maju. Chat CS biasa ikut mendarat di sini dan tidak pernah diserap
 * siapa pun, jadi barisnya dibuang setelah dua hari.
 */
async function tahanStatusYatim(env: Env, daftar: { wamid: string; status: string; billable: number | null }[]): Promise<void> {
  if (daftar.length === 0) return
  const sekarang = new Date().toISOString()
  const batasBuang = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()

  const pernyataan = daftar.map((d) =>
    env.DB.prepare(
      `INSERT INTO status_menunggu (wamid, status, billable, waktu) VALUES (?, ?, ?, ?)
       ON CONFLICT(wamid) DO UPDATE SET
         status = CASE
           WHEN status_menunggu.status = 'gagal' THEN status_menunggu.status
           WHEN excluded.status = 'gagal' THEN excluded.status
           WHEN ${peringkatSql('excluded.status')} > ${peringkatSql('status_menunggu.status')}
             THEN excluded.status
           ELSE status_menunggu.status
         END,
         billable = COALESCE(excluded.billable, status_menunggu.billable),
         waktu = excluded.waktu`,
    ).bind(d.wamid, d.status, d.billable, sekarang),
  )
  pernyataan.push(env.DB.prepare(`DELETE FROM status_menunggu WHERE waktu < ?`).bind(batasBuang))
  await env.DB.batch(pernyataan)
}

/** Urutan status sebagai angka, dipakai di dalam SQL supaya aturannya cuma ditulis sekali. */
function peringkatSql(kolom: string): string {
  return `(CASE ${kolom} WHEN 'dibaca' THEN 3 WHEN 'sampai' THEN 2 WHEN 'terkirim' THEN 1 ELSE 0 END)`
}

/**
 * Menerapkan status dari webhook Meta. Dua langkah supaya "wamid dikenal" dihitung
 * benar walau statusnya tidak jadi maju (mis. event 'delivered' basi yang tiba setelah
 * 'read' sudah tersimpan): pertama SELECT status yang sudah ada, baru tentukan mana
 * yang perlu di-UPDATE, lalu tembak semuanya sekaligus lewat batch().
 */
export async function terapkanStatusMeta(
  env: Env,
  statuses: StatusMeta[],
): Promise<{ dikenal: number; dilewati: number }> {
  const valid = statuses.filter((s) => s.id && PETA_STATUS[s.status])
  if (valid.length === 0) return { dikenal: 0, dilewati: statuses.length }

  const wamids = [...new Set(valid.map((s) => s.id))]
  const placeholder = wamids.map(() => '?').join(',')
  const { results } = await env.DB.prepare(
    `SELECT wamid, status_terakhir FROM pesan WHERE wamid IN (${placeholder})`,
  )
    .bind(...wamids)
    .all<{ wamid: string; status_terakhir: string }>()

  const tersimpan = new Map((results ?? []).map((r) => [r.wamid, r.status_terakhir]))
  const sekarang = new Date().toISOString()
  const pernyataan = []
  const yatim: { wamid: string; status: string; billable: number | null }[] = []

  for (const s of valid) {
    const billable = s.pricing?.billable === undefined ? null : s.pricing.billable ? 1 : 0
    const statusLama = tersimpan.get(s.id)
    if (statusLama === undefined) {
      // Belum tentu asing: bisa jadi barisnya memang belum sempat ditulis n8n. Ditahan
      // dulu, diserap nanti oleh simpanDaftarPesan. Chat CS yang nyasar ke sini terbuang
      // sendiri lewat pembersihan dua hari.
      yatim.push({ wamid: s.id, status: PETA_STATUS[s.status], billable: billable })
      continue
    }

    const statusBaru = PETA_STATUS[s.status]
    const maju = statusLama !== 'gagal' && (statusBaru === 'gagal' || (URUTAN[statusBaru] ?? 0) > (URUTAN[statusLama] ?? 0))
    if (!maju) continue

    pernyataan.push(
      // COALESCE: cuma event 'delivered' yang membawa `pricing`. Tanpa ini, event 'read'
      // yang datang sesudahnya akan menghapus penanda billable yang sudah tersimpan.
      env.DB.prepare(
        `UPDATE pesan SET status_terakhir = ?, billable = COALESCE(?, billable), diperbarui = ? WHERE wamid = ?`,
      ).bind(
        statusBaru,
        billable,
        sekarang,
        s.id,
      ),
    )
  }

  if (pernyataan.length > 0) await env.DB.batch(pernyataan)
  await tahanStatusYatim(env, yatim)

  const dikenal = tersimpan.size
  const dilewati = statuses.length - dikenal
  return { dikenal, dilewati }
}

/** Ringkasan per run dipakai GET /api/progress. `sampai` mencakup yang sudah `dibaca` juga. */
export async function ringkasanPesanRun(env: Env, runId: string): Promise<{ sampai: number; dibaca: number }> {
  const baris = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN status_terakhir IN ('sampai', 'dibaca') THEN 1 ELSE 0 END) AS sampai,
       SUM(CASE WHEN status_terakhir = 'dibaca' THEN 1 ELSE 0 END) AS dibaca
     FROM pesan WHERE run_id = ?`,
  )
    .bind(runId)
    .first<{ sampai: number | null; dibaca: number | null }>()
  return { sampai: baris?.sampai ?? 0, dibaca: baris?.dibaca ?? 0 }
}

/**
 * Ringkasan pesan broadcast dalam rentang waktu, dipakai kartu "bulan ini" di dashboard.
 * `null` selama tabel `pesan` masih kosong sama sekali -- layar harus menampilkan
 * "belum ada datanya", bukan angka nol yang menyesatkan.
 */
export async function ringkasanRentang(
  env: Env,
  mulaiIso: string,
  selesaiIso: string,
): Promise<{ sampai: number; dibaca: number } | null> {
  const total = await env.DB.prepare(`SELECT COUNT(*) AS n FROM pesan`).first<{ n: number }>()
  if (!total || total.n === 0) return null

  const baris = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN status_terakhir IN ('sampai', 'dibaca') THEN 1 ELSE 0 END) AS sampai,
       SUM(CASE WHEN status_terakhir = 'dibaca' THEN 1 ELSE 0 END) AS dibaca
     FROM pesan WHERE diperbarui >= ? AND diperbarui < ?`,
  )
    .bind(mulaiIso, selesaiIso)
    .first<{ sampai: number | null; dibaca: number | null }>()
  return { sampai: baris?.sampai ?? 0, dibaca: baris?.dibaca ?? 0 }
}

/**
 * Perubahan sejak waktu tertentu, dipakai cron n8n untuk menulis balik ke Google Sheet.
 * Sengaja `>=`, bukan `>`: satu kelompok webhook memberi `diperbarui` yang persis sama ke
 * banyak baris, jadi kursor `>` akan membuang sisa baris berwaktu kembar begitu halaman
 * 2.000 terpotong di tengahnya. Penulisan ke Sheet dicocokkan per wamid, jadi baris yang
 * terkirim dua kali menimpa dirinya sendiri -- aman, dan tidak ada yang hilang.
 */
export async function ambilPerubahanSejak(env: Env, sejak: string): Promise<PesanPerubahan[]> {
  const { results } = await env.DB.prepare(
    `SELECT wamid, nomor, run_id, status_terakhir, billable, diperbarui
     FROM pesan WHERE diperbarui >= ? ORDER BY diperbarui ASC, wamid ASC
     LIMIT ${MAKS_BARIS_TULIS_BALIK}`,
  )
    .bind(sejak)
    .all<PesanPerubahan>()
  return results ?? []
}
