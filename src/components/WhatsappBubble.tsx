import type { ReactNode } from 'react'
import type { Tombol } from '../types'

/**
 * Ubah teks WhatsApp jadi elemen React. Cuma dua format yang dikenal WhatsApp:
 * `*tebal*` dan `_miring_`. Tidak pakai library, tidak pakai HTML mentah —
 * potongan teks dibedah manual lalu dirender sebagai elemen biasa.
 */
function renderTeksWhatsapp(teks: string): ReactNode[] {
  const potongan = teks.split(/(\*[^*\n]+\*|_[^_\n]+_)/g)
  return potongan.map((bagian, i) => {
    if (bagian.length > 2 && bagian.startsWith('*') && bagian.endsWith('*')) {
      return <strong key={i}>{bagian.slice(1, -1)}</strong>
    }
    if (bagian.length > 2 && bagian.startsWith('_') && bagian.endsWith('_')) {
      return <em key={i}>{bagian.slice(1, -1)}</em>
    }
    return bagian
  })
}

export default function WhatsappBubble({
  isiPesan,
  footer,
  gambarUrl,
  tombol,
}: {
  isiPesan: string
  footer: string
  gambarUrl: string
  tombol: Tombol[]
}) {
  return (
    <div className="mx-auto max-w-[320px] overflow-hidden rounded-2xl rounded-tl-sm bg-[#e7f8d8] shadow-sm">
      {gambarUrl && (
        <img src={gambarUrl} alt="Gambar promo" className="w-full" />
      )}
      <div className="px-3 pb-2 pt-3">
        <p className="whitespace-pre-wrap text-[13.5px] leading-snug text-slate-800">
          {renderTeksWhatsapp(isiPesan)}
        </p>
        {footer && <p className="mt-1.5 text-[11px] text-slate-500">{footer}</p>}
      </div>
      {tombol.map((t, i) => (
        <div
          key={i}
          className="flex min-h-[40px] items-center justify-center border-t border-black/5 text-[13.5px] font-medium text-[#00a5f4]"
        >
          {t.teks}
        </div>
      ))}
    </div>
  )
}
