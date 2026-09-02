import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import WhatsappBubble from './WhatsappBubble'
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
  // Cuma satu kartu terbuka sekaligus — dua preview terbuka bikin layar HP
  // panjang sekali dan staf kehilangan konteks kartu mana yang dia baca.
  const [dibuka, setDibuka] = useState<string | null>(null)

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
      <p className="mb-4 text-sm text-slate-500">
        Ketuk kartu untuk membaca isi pesannya dulu, persis seperti yang akan diterima tamu.
      </p>

      <div className="space-y-3">
        {muatan.data.map((p) => (
          <KartuPromo
            key={p.template}
            promo={p}
            terbuka={dibuka === p.template}
            onBuka={() => setDibuka(dibuka === p.template ? null : p.template)}
            onPilih={onPilih}
          />
        ))}
      </div>
    </div>
  )
}

function PreviewPesan({ promo }: { promo: PromoApi }) {
  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <p className="mb-2 text-xs font-semibold text-slate-500">Yang tamu terima di WhatsApp</p>

      {promo.butuh_gambar && !promo.gambar_url && (
        <p className="mb-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Promo ini pakai gambar. Gambarnya diupload nanti di langkah berikutnya.
        </p>
      )}

      <div className="rounded-2xl bg-[#0b141a] p-3">
        <WhatsappBubble
          isiPesan={promo.isi_pesan}
          footer={promo.footer}
          gambarUrl={promo.gambar_url}
          tombol={promo.tombol}
        />
      </div>

      {promo.tombol.length === 0 && (
        <p className="mt-2 text-xs text-amber-700">
          Promo ini tidak punya tombol, jadi tamu harus menyalin sendiri linknya. Balasannya
          biasanya jauh lebih sedikit.
        </p>
      )}
    </div>
  )
}

function KartuPromo({
  promo,
  terbuka,
  onBuka,
  onPilih,
}: {
  promo: PromoApi
  terbuka: boolean
  onBuka: () => void
  onPilih: (promo: PromoApi) => void
}) {
  const bisaDiklik = promo.bisa_dikirim

  return (
    <div className={'card p-3 ' + (bisaDiklik ? '' : 'opacity-60')}>
      {/* Ketuk kartu = buka/tutup preview, BUKAN langsung lanjut. Memilih promo
          butuh ketukan kedua di tombol di bawah preview, supaya tidak ada staf
          yang lanjut ke langkah kirim tanpa pernah membaca isinya. */}
      <button
        type="button"
        onClick={onBuka}
        aria-expanded={terbuka}
        className="flex w-full min-h-[48px] items-center gap-3 text-left"
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
        <svg
          viewBox="0 0 24 24"
          className={'h-5 w-5 shrink-0 text-slate-400 transition ' + (terbuka ? 'rotate-180' : '')}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {terbuka && (
        <>
          <PreviewPesan promo={promo} />
          {bisaDiklik && (
            <button type="button" onClick={() => onPilih(promo)} className="btn-primary mt-3 w-full">
              Pakai promo ini
            </button>
          )}
        </>
      )}
    </div>
  )
}
