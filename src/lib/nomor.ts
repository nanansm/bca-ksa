/**
 * Salin PERSIS dari node `Rapikan Kontak` di workflow n8n `KSA - Tambah Kontak`
 * (lihat KONTRAK-DAFTAR-TAMU.md). JANGAN diubah -- beda satu aturan berarti nomor
 * yang lolos di satu sisi terbuang di sisi lain.
 */
export function norm(x: unknown): string | null {
  let d = String(x ?? '').replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('6262')) d = '62' + d.slice(4)
  else if (d.startsWith('620')) d = '62' + d.slice(3)
  if (d.startsWith('0')) d = '62' + d.slice(1)
  else if (d.startsWith('8')) d = '62' + d
  if (!d.startsWith('628')) return null
  if (d.length < 11 || d.length > 14) return null
  return d
}

const KATA_KOLOM_NOMOR = [
  'nomor', 'no hp', 'nohp', 'phone', 'telp', 'telepon', 'hp', 'whatsapp', 'wa', 'mobile', 'contact', 'kontak',
]

const KATA_KOLOM_NAMA = ['nama', 'name', 'guest', 'tamu', 'pemesan', 'customer']

export interface HasilBaca {
  kolomNomor: string
  kolomNama: string | null
  barisFile: number
  terbaca: number
  rusak: number
  kosong: number
  dobelDiFile: number
  nomor: { nomor: string; nama: string }[]
}

/**
 * Cari header kolom nomor. Loop KATA dulu (bukan header dulu) supaya kata yang lebih
 * spesifik ('no hp') menang lebih dulu daripada kata generik ('wa') apa pun urutan
 * kolom di file aslinya.
 */
function cariKolomNomor(headers: string[], rows: Record<string, unknown>[]): string {
  const lower = headers.map((h) => h.toLowerCase())
  for (const kata of KATA_KOLOM_NOMOR) {
    const idx = lower.findIndex((h) => h.includes(kata))
    if (idx !== -1) return headers[idx]
  }

  let terbaik: string | null = null
  let terbanyak = 0
  for (const h of headers) {
    const valid = rows.reduce((n, r) => (norm(r[h]) !== null ? n + 1 : n), 0)
    if (valid > terbanyak) {
      terbanyak = valid
      terbaik = h
    }
  }
  if (terbaik) return terbaik

  throw new Error('Tidak ada kolom berisi nomor HP di file ini.')
}

function cariKolomNama(headers: string[], kolomNomor: string): string | null {
  const lower = headers.map((h) => h.toLowerCase())
  for (const kata of KATA_KOLOM_NAMA) {
    const idx = lower.findIndex((h, i) => headers[i] !== kolomNomor && h.includes(kata))
    if (idx !== -1) return headers[idx]
  }
  return null
}

/** Baca baris hasil `sheet_to_json`, aturan hitung persis node n8n -- lihat KONTRAK-DAFTAR-TAMU.md. */
export function bacaBaris(rows: Record<string, unknown>[]): HasilBaca {
  if (rows.length === 0) throw new Error('Tidak ada kolom berisi nomor HP di file ini.')

  const headers = Object.keys(rows[0])
  const kolomNomor = cariKolomNomor(headers, rows)
  const kolomNama = cariKolomNama(headers, kolomNomor)

  let rusak = 0
  let kosong = 0
  let dobelDiFile = 0
  const dipakai = new Set<string>()
  const nomor: { nomor: string; nama: string }[] = []

  for (const row of rows) {
    const mentah = row[kolomNomor]
    if (mentah === undefined || mentah === null || String(mentah).trim() === '') {
      kosong++
      continue
    }
    const bersih = norm(mentah)
    if (!bersih) {
      rusak++
      continue
    }
    if (dipakai.has(bersih)) {
      dobelDiFile++
      continue
    }
    dipakai.add(bersih)
    nomor.push({ nomor: bersih, nama: kolomNama ? String(row[kolomNama] ?? '').trim() : '' })
  }

  return { kolomNomor, kolomNama, barisFile: rows.length, terbaca: nomor.length, rusak, kosong, dobelDiFile, nomor }
}
