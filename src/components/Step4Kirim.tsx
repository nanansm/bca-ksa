import { useState } from 'react'
import HoldButton from './HoldButton'
import type { HitungResult, Maks, PromoView } from '../types'

const angka = (n: number) => n.toLocaleString('id-ID')

export default function Step4Kirim({
  promo,
  maks,
  hasil,
  onKonfirmasi,
  onBack,
  busy,
  error,
}: {
  promo: PromoView
  maks: Maks
  hasil: HitungResult
  onKonfirmasi: () => void
  onBack: () => void
  busy: boolean
  error: string
}) {
  const semuaTamu = maks === 0
  const modeUji = maks === -1
  const [sudahYakin, setSudahYakin] = useState(false)
  const perluTombolTahan = !semuaTamu || sudahYakin

  return (
    <div>
      <button onClick={onBack} disabled={busy} className="btn-ghost mb-4">
        ← Kembali
      </button>

      <div className="card p-5 text-center">
        <p className="text-base text-slate-700">
          Kirim promo <span className="font-bold text-slate-900">{promo.nama}</span> ke{' '}
          <span className="font-bold text-slate-900">
            {modeUji ? '1 nomor Mote' : `${angka(hasil.akan_dikirim)} tamu`}
          </span>
          .
        </p>
        {modeUji && (
          <p className="mt-2 text-sm text-slate-500">
            Ini percobaan. Tidak ada tamu yang menerima pesannya.
          </p>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {semuaTamu && !sudahYakin && (
        <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="mb-3 text-sm font-semibold text-amber-800">
            Ini akan mengirim ke SEMUA tamu, bukan sebagian. Pastikan sudah benar sebelum lanjut.
          </p>
          <button onClick={() => setSudahYakin(true)} className="btn-ghost w-full bg-white">
            Saya yakin, kirim ke semua tamu
          </button>
        </div>
      )}

      {perluTombolTahan && (
        <div className="mt-5">
          <p className="mb-2 text-center text-xs text-slate-500">
            Tekan dan tahan tombol di bawah selama 3 detik untuk mengirim.
          </p>
          <HoldButton label="Tahan untuk kirim" onSelesai={onKonfirmasi} disabled={busy} />
        </div>
      )}
    </div>
  )
}
