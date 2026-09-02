import type { KirimResult } from '../types'

const angka = (n: number) => n.toLocaleString('id-ID')

export default function Step5Progres({
  progres,
  error,
  onMulaiBaru,
}: {
  progres: KirimResult | null
  error: string
  onMulaiBaru: () => void
}) {
  if (!progres) {
    if (error) {
      return (
        <div className="card space-y-3 p-6 text-center">
          <p className="text-sm text-slate-600">{error}</p>
          <button onClick={onMulaiBaru} className="btn-ghost mx-auto">
            Kirim promo lain
          </button>
        </div>
      )
    }
    return (
      <div className="card flex flex-col items-center gap-3 p-8 text-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-[#1a3a2a]" />
        <p className="text-sm text-slate-500">Memuat progres pengiriman…</p>
      </div>
    )
  }

  const persen = progres.target > 0 ? Math.min(100, (progres.terkirim / progres.target) * 100) : 100

  return (
    <div>
      <p className="mb-1 text-center text-sm text-slate-500">{progres.promo}</p>
      <h1 className="mb-6 text-center text-lg font-bold text-slate-900">
        {progres.status === 'jalan' && 'Sedang mengirim'}
        {progres.status === 'selesai' && 'Pengiriman selesai'}
        {progres.status === 'dihentikan' && 'Pengiriman dihentikan'}
      </h1>

      <div className="card p-5">
        <div className="mb-2 h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-400 transition-[width]"
            style={{ width: `${persen}%` }}
          />
        </div>
        <p className="text-center text-sm text-slate-600">
          <span className="font-bold text-slate-900">{angka(progres.terkirim)}</span> dari{' '}
          {angka(progres.target)} terkirim
        </p>
        {progres.gagal > 0 && (
          <p className="mt-1 text-center text-xs text-red-600">{angka(progres.gagal)} gagal</p>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {progres.status === 'dihentikan' && (
        <div className="mt-5 rounded-xl border border-red-300 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">
            Pengiriman berhenti sebelum selesai. Jangan mencoba kirim ulang sendiri, hubungi Mote
            dulu.
          </p>
        </div>
      )}

      {progres.status === 'selesai' && (
        <button onClick={onMulaiBaru} className="btn-primary mt-5">
          Kirim promo lain
        </button>
      )}
    </div>
  )
}
