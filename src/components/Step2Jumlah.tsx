import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { DaftarApi, HitungResult, Maks, PromoApi, ResponPengaturan } from '../types'

const angka = (n: number) => new Intl.NumberFormat('id-ID').format(n)

// Belum jadi pengaturan (lihat KONTRAK-DAFTAR-TAMU.md) -- kalau nanti perlu diubah
// staf, pindahkan ke tabel pengaturan seperti tarif & batas harian.
const JARAK_MIN_HARI = 14

const PILIHAN: { maks: Maks; label: string; keterangan: string }[] = [
  { maks: -1, label: 'Uji dulu', keterangan: '1 pesan ke nomor Mote, tidak ada tamu yang menerima' },
  { maks: 25, label: '25 tamu', keterangan: 'Kirim ke 25 tamu pertama yang lolos saring' },
  { maks: 200, label: '200 tamu', keterangan: 'Kirim ke 200 tamu pertama yang lolos saring' },
  { maks: 1000, label: '1.000 tamu', keterangan: 'Kirim ke 1.000 tamu pertama yang lolos saring' },
  { maks: 0, label: 'Semua tamu', keterangan: 'Kirim ke seluruh tamu yang lolos saring' },
]

function hariIniJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

/** Jumlah hari dari `checkoutIso` (YYYY-MM-DD) sampai hari ini di Asia/Jakarta. */
function hariSejakCheckout(checkoutIso: string): number {
  const dari = Date.parse(`${checkoutIso}T00:00:00Z`)
  const sekarang = Date.parse(`${hariIniJakarta()}T00:00:00Z`)
  return Math.round((sekarang - dari) / 86_400_000)
}

type MuatanDaftar = { status: 'memuat' } | { status: 'siap'; data: DaftarApi[] }

export default function Step2Jumlah({
  promo,
  pengaturan,
  onHitung,
  onBack,
  onSesiHabis,
}: {
  promo: PromoApi
  /** Perkiraan tarif & sisa kuota dari /api/pengaturan. `null` kalau gagal dimuat. */
  pengaturan: ResponPengaturan | null
  onHitung: (hasil: HitungResult, maks: Maks, daftarId: string) => void
  onBack: () => void
  onSesiHabis: () => void
}) {
  const [menghitung, setMenghitung] = useState<Maks | null>(null)
  const [error, setError] = useState('')

  const [daftar, setDaftar] = useState<MuatanDaftar>({ status: 'memuat' })
  const [daftarId, setDaftarId] = useState('') // '' = Semua tamu

  useEffect(() => {
    api
      .daftarList()
      .then((r) => setDaftar({ status: 'siap', data: r.daftar }))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) return onSesiHabis()
        // Gagal muat daftar bukan alasan buat mengunci Kirim Promo -- perlakukan
        // sama seperti belum ada daftar tersimpan (pemilih disembunyikan).
        setDaftar({ status: 'siap', data: [] })
      })
    // eslint-disable-next-line
  }, [])

  function pilih(maks: Maks) {
    setError('')
    setMenghitung(maks)
    api
      .hitung(promo.template, promo.nama, maks, daftarId)
      .then((hasil) => onHitung(hasil, maks, daftarId))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) return onSesiHabis()
        setError(err instanceof Error ? err.message : 'Gagal menghitung jumlah penerima.')
        setMenghitung(null)
      })
  }

  const daftarTerpilih = daftar.status === 'siap' ? daftar.data.find((d) => d.id === daftarId) : undefined
  const hariCheckout = daftarTerpilih?.checkout_terakhir ? hariSejakCheckout(daftarTerpilih.checkout_terakhir) : null
  const perluPeringatan = hariCheckout !== null && hariCheckout < JARAK_MIN_HARI

  return (
    <div>
      <button onClick={onBack} className="btn-ghost mb-4">
        ← Kembali
      </button>

      <h1 className="mb-1 text-lg font-bold text-slate-900">Kirim ke berapa tamu?</h1>
      <p className="mb-1 text-sm text-slate-500">
        Promo: <span className="font-semibold text-slate-700">{promo.nama}</span>
      </p>
      {pengaturan && (
        <p className="mb-4 text-xs text-slate-500">
          Sisa kuota nomor hari ini:{' '}
          <span className="font-semibold text-slate-700">{angka(pengaturan.sisa_kuota)}</span>
        </p>
      )}
      {!pengaturan && <div className="mb-4" />}

      {menghitung === null && daftar.status === 'siap' && daftar.data.length > 0 && (
        <div className="card mb-4 p-4">
          <label htmlFor="penerima" className="mb-1.5 block text-sm font-medium text-slate-700">
            Kirim ke
          </label>
          <select
            id="penerima"
            value={daftarId}
            onChange={(e) => setDaftarId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-brand-400 focus:bg-white"
          >
            <option value="">Semua tamu</option>
            {daftar.data.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nama} ({angka(d.jumlah)} nomor)
              </option>
            ))}
          </select>

          {perluPeringatan && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Tamu di daftar ini baru check-out {Math.max(0, hariCheckout ?? 0)} hari lalu. Mote menyarankan
              menunggu sampai {JARAK_MIN_HARI} hari supaya promonya tidak terasa mengganggu.
            </p>
          )}
        </div>
      )}

      {menghitung !== null && (
        <div className="card mb-4 flex flex-col items-center gap-3 p-6 text-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-[#1a3a2a]" />
          <p className="text-sm text-slate-600">
            Menghitung tamu yang akan menerima pesan ini. Bisa sampai 20 detik.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {menghitung === null && (
        <div className="space-y-3">
          {PILIHAN.map((p, i) => {
            // Perkiraan rupiah cuma bisa dihitung kalau tarif sudah dimuat, dan
            // tidak ditampilkan untuk mode uji (tidak ada tamu yang dikirimi).
            let rupiahTeks = ''
            let potongTeks = ''
            if (p.maks !== -1 && pengaturan) {
              const tarif = pengaturan.tarif_per_pesan
              const sisaKuota = pengaturan.sisa_kuota
              if (p.maks === 0) {
                rupiahTeks = `Perkiraan hingga Rp ${angka(sisaKuota * tarif)}`
                potongTeks =
                  'Kalau tamu yang lolos lebih banyak dari sisa kuota, kiriman dipotong otomatis dan sisanya bisa dikirim besok.'
              } else {
                const kenaPotong = p.maks > sisaKuota
                const efektif = kenaPotong ? sisaKuota : p.maks
                rupiahTeks = `Perkiraan Rp ${angka(efektif * tarif)}`
                if (kenaPotong) {
                  potongTeks = `Sisa kuota hari ini cuma ${angka(sisaKuota)}, jumlahnya akan dipotong dan sisanya bisa dikirim besok.`
                }
              }
            }

            return (
              <button
                key={p.maks}
                onClick={() => pilih(p.maks)}
                className={
                  i === 0
                    ? 'card w-full min-h-[52px] border-2 border-[#1a3a2a] bg-[#1a3a2a]/5 p-4 text-left active:scale-[0.99]'
                    : 'card w-full min-h-[52px] p-4 text-left active:scale-[0.99]'
                }
              >
                <p className="text-base font-bold text-slate-900">{p.label}</p>
                <p className="text-xs text-slate-500">{p.keterangan}</p>
                {rupiahTeks && (
                  <p className="mt-1 text-xs font-semibold text-[#1a3a2a]">{rupiahTeks}</p>
                )}
                {potongTeks && <p className="mt-1 text-xs text-amber-600">{potongTeks}</p>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
