import { useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { HitungResult, Maks, PromoView } from '../types'

const PILIHAN: { maks: Maks; label: string; keterangan: string }[] = [
  { maks: -1, label: 'Uji dulu', keterangan: '1 pesan ke nomor Mote, tidak ada tamu yang menerima' },
  { maks: 25, label: '25 tamu', keterangan: 'Kirim ke 25 tamu pertama yang lolos saring' },
  { maks: 200, label: '200 tamu', keterangan: 'Kirim ke 200 tamu pertama yang lolos saring' },
  { maks: 1000, label: '1.000 tamu', keterangan: 'Kirim ke 1.000 tamu pertama yang lolos saring' },
  { maks: 0, label: 'Semua tamu', keterangan: 'Kirim ke seluruh tamu yang lolos saring' },
]

export default function Step2Jumlah({
  promo,
  onHitung,
  onBack,
  onSesiHabis,
}: {
  promo: PromoView
  onHitung: (hasil: HitungResult, maks: Maks) => void
  onBack: () => void
  onSesiHabis: () => void
}) {
  const [menghitung, setMenghitung] = useState<Maks | null>(null)
  const [error, setError] = useState('')

  function pilih(maks: Maks) {
    setError('')
    setMenghitung(maks)
    api
      .hitung(promo.template, promo.nama, maks)
      .then((hasil) => onHitung(hasil, maks))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) return onSesiHabis()
        setError(err instanceof Error ? err.message : 'Gagal menghitung jumlah penerima.')
        setMenghitung(null)
      })
  }

  return (
    <div>
      <button onClick={onBack} className="btn-ghost mb-4">
        ← Kembali
      </button>

      <h1 className="mb-1 text-lg font-bold text-slate-900">Kirim ke berapa tamu?</h1>
      <p className="mb-4 text-sm text-slate-500">
        Promo: <span className="font-semibold text-slate-700">{promo.nama}</span>
      </p>

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
          {PILIHAN.map((p, i) => (
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
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
