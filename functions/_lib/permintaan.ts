/** Jumlah penerima yang boleh diminta. -1 = uji ke nomor Mote, 0 = semua tamu. */
export const JUMLAH_SAH = [-1, 25, 200, 1000, 0]

export interface Permintaan {
  template: string
  label: string
  maks: number
  /** '' = semua tamu (perilaku lama). `hitung.ts` dan `kirim.ts` menyebar field ini
   * apa adanya ke payload n8n, jadi otomatis sampai tanpa menyentuh dua file itu. */
  daftar_id: string
}

export async function bacaPermintaan(request: Request): Promise<Permintaan | { error: string }> {
  let body: { template?: unknown; label?: unknown; maks?: unknown; daftar_id?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return { error: 'Permintaan tidak terbaca.' }
  }

  const template = String(body.template ?? '').trim()
  if (!/^[a-z0-9_]{2,80}$/.test(template)) return { error: 'Promo tidak dikenali.' }

  const maks = Number(body.maks)
  if (!JUMLAH_SAH.includes(maks)) return { error: 'Jumlah penerima tidak sah.' }

  const daftarId = String(body.daftar_id ?? '').trim()
  if (daftarId && !/^[0-9a-f-]{36}$/.test(daftarId)) return { error: 'Daftar tidak dikenali.' }

  return { template, label: String(body.label ?? template).slice(0, 120), maks, daftar_id: daftarId }
}
