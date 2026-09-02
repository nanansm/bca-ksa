import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { entriKatalog } from '../lib/katalog'
import type { PromoView } from '../types'

type Muatan =
  | { status: 'memuat' }
  | { status: 'gagal'; pesan: string }
  | { status: 'siap'; data: PromoView[] }

export default function Step1Promo({
  onPilih,
  onSesiHabis,
}: {
  onPilih: (promo: PromoView) => void
  onSesiHabis: () => void
}) {
  const [muatan, setMuatan] = useState<Muatan>({ status: 'memuat' })
  const [buka, setBuka] = useState(false)

  function muat() {
    setMuatan({ status: 'memuat' })
    api
      .promos()
      .then((r) => {
        const gabung: PromoView[] = r.promos.map((p) => ({ ...p, ...entriKatalog(p.template) }))
        gabung.sort((a, b) => a.urut - b.urut)
        setMuatan({ status: 'siap', data: gabung })
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) return onSesiHabis()
        setMuatan({
          status: 'gagal',
          pesan: err instanceof Error ? err.message : 'Gagal memuat daftar promo.',
        })
      })
  }

  useEffect(muat, [])

  if (muatan.status === 'memuat') {
    return (
      <div className="card flex flex-col items-center gap-3 p-8 text-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-[#1a3a2a]" />
        <p className="text-sm text-slate-500">Memuat daftar promo…</p>
      </div>
    )
  }

  if (muatan.status === 'gagal') {
    return (
      <div className="card space-y-3 p-5 text-center">
        <p className="text-sm text-slate-600">{muatan.pesan}</p>
        <button onClick={muat} className="btn-ghost mx-auto">
          Coba lagi
        </button>
      </div>
    )
  }

  const siap = muatan.data.filter((p) => !p.kedaluwarsa && p.bisa_dikirim)
  const lama = muatan.data.filter((p) => p.kedaluwarsa || !p.bisa_dikirim)

  if (siap.length === 0 && lama.length === 0) {
    return (
      <div className="card p-5 text-center">
        <p className="text-sm text-slate-600">Belum ada promo yang bisa ditampilkan.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold text-slate-900">Pilih promo yang mau dikirim</h1>
      <p className="mb-4 text-sm text-slate-500">Ketuk salah satu kartu di bawah.</p>

      <div className="space-y-3">
        {siap.map((p) => (
          <KartuPromo key={p.template} promo={p} onPilih={onPilih} />
        ))}
      </div>

      {lama.length > 0 && !buka && (
        <button onClick={() => setBuka(true)} className="btn-ghost mt-4 w-full">
          Tampilkan promo lama ({lama.length})
        </button>
      )}

      {buka && (
        <div className="mt-4 space-y-3">
          {lama.map((p) => (
            <KartuPromo key={p.template} promo={p} onPilih={onPilih} />
          ))}
        </div>
      )}
    </div>
  )
}

function KartuPromo({
  promo,
  onPilih,
}: {
  promo: PromoView
  onPilih: (promo: PromoView) => void
}) {
  const siapKirim = !promo.kedaluwarsa && promo.bisa_dikirim
  const bisaDiklik = promo.bisa_dikirim

  return (
    <button
      type="button"
      disabled={!bisaDiklik}
      onClick={() => onPilih(promo)}
      className={
        'card flex w-full min-h-[48px] items-center gap-3 p-3 text-left ' +
        (bisaDiklik ? 'active:scale-[0.99]' : 'opacity-60')
      }
    >
      {promo.gambar_url && (
        <img
          src={promo.gambar_url.replace(/\/([^/]+)$/, '/kecil/$1')}
          alt=""
          width={56}
          height={56}
          loading="lazy"
          decoding="async"
          className="h-14 w-14 shrink-0 rounded-lg bg-slate-100 object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-bold text-slate-900">{promo.nama}</span>
          {siapKirim && (
            <span className="shrink-0 rounded-full bg-[#96CD50]/25 px-2 py-0.5 text-[11px] font-semibold text-[#1a3a2a]">
              Siap kirim
            </span>
          )}
          {!siapKirim && promo.kedaluwarsa && (
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              {promo.kedaluwarsa}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">{promo.ringkas}</p>
        {!bisaDiklik && (
          <p className="mt-1 text-xs font-medium text-red-600">
            Tidak bisa dikirim: {promo.alasan_tak_bisa || 'sebab tidak diketahui'}
          </p>
        )}
      </div>
    </button>
  )
}
