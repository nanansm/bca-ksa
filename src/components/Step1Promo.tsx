import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { PromoApi } from '../types'

type Muatan =
  | { status: 'memuat' }
  | { status: 'gagal'; pesan: string }
  | { status: 'siap'; data: PromoApi[] }

export default function Step1Promo({
  onPilih,
  onSesiHabis,
}: {
  onPilih: (promo: PromoApi) => void
  onSesiHabis: () => void
}) {
  const [muatan, setMuatan] = useState<Muatan>({ status: 'memuat' })

  function muat() {
    setMuatan({ status: 'memuat' })
    api
      .promos()
      .then((r) => {
        const diurutkan = [...r.promos].sort((a, b) => a.urut - b.urut)
        setMuatan({ status: 'siap', data: diurutkan })
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

  // Server hanya mengirim promo yang statusnya disetujui Meta, tercatat di
  // katalog, dan belum kedaluwarsa — jadi daftar ini sudah "siap tayang".
  if (muatan.data.length === 0) {
    return (
      <div className="card space-y-2 p-5 text-center">
        <p className="text-sm font-semibold text-slate-700">Tidak ada promo berlaku saat ini.</p>
        <p className="text-sm text-slate-500">
          Hubungi tim Moté dulu untuk membuat promo baru sebelum bisa mengirim broadcast.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold text-slate-900">Pilih promo yang mau dikirim</h1>
      <p className="mb-4 text-sm text-slate-500">Ketuk salah satu kartu di bawah.</p>

      <div className="space-y-3">
        {muatan.data.map((p) => (
          <KartuPromo key={p.template} promo={p} onPilih={onPilih} />
        ))}
      </div>
    </div>
  )
}

function KartuPromo({
  promo,
  onPilih,
}: {
  promo: PromoApi
  onPilih: (promo: PromoApi) => void
}) {
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
          {bisaDiklik && (
            <span className="shrink-0 rounded-full bg-[#96CD50]/25 px-2 py-0.5 text-[11px] font-semibold text-[#1a3a2a]">
              Siap kirim
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
