import WhatsappBubble from './WhatsappBubble'
import type { DibuangRincian, HitungResult, Maks, PromoApi } from '../types'

const LABEL_DIBUANG: { kunci: keyof DibuangRincian; teks: string }[] = [
  { kunci: 'sudah_optout', teks: 'sudah minta berhenti' },
  { kunci: 'nomor_mati', teks: 'nomornya tidak aktif' },
  { kunci: 'nomor_rusak', teks: 'format nomornya rusak' },
  { kunci: 'baru_dikirimi', teks: 'baru saja dikirimi' },
  { kunci: 'gagal_berulang', teks: 'gagal berulang kali' },
  { kunci: 'tak_pernah_buka', teks: 'tidak pernah membuka' },
  { kunci: 'duplikat', teks: 'nomor kembar' },
]

const angka = (n: number) => new Intl.NumberFormat('id-ID').format(n)

export default function Step3Pratinjau({
  promo,
  hasil,
  maks,
  tarifPerPesan,
  onLanjut,
  onBack,
}: {
  promo: PromoApi
  hasil: HitungResult
  maks: Maks
  /** Tarif per pesan dari /api/pengaturan. `null` kalau gagal dimuat — baris biaya disembunyikan. */
  tarifPerPesan: number | null
  onLanjut: () => void
  onBack: () => void
}) {
  const modeUji = maks === -1
  const rincianDibuang = LABEL_DIBUANG.filter((l) => hasil.dibuang[l.kunci] > 0)
  const biaya = !modeUji && tarifPerPesan !== null ? hasil.akan_dikirim * tarifPerPesan : null

  return (
    <div>
      <button onClick={onBack} className="btn-ghost mb-4">
        ← Kembali
      </button>

      <h1 className="mb-1 text-lg font-bold text-slate-900">Pratinjau pesan</h1>
      <p className="mb-4 text-sm text-slate-500">Begini kira-kira tampilan pesannya di WhatsApp tamu.</p>

      {hasil.peringatan && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-800">{hasil.peringatan}</p>
        </div>
      )}

      <div className="rounded-2xl bg-[#0b141a] p-4">
        <WhatsappBubble
          isiPesan={hasil.isi_pesan}
          footer={promo.footer}
          gambarUrl={hasil.gambar_url || promo.gambar_url}
          tombol={promo.tombol}
        />
      </div>

      <div className="card mt-4 p-4">
        {modeUji ? (
          <p className="text-sm text-slate-600">
            Pesan ini hanya dikirim ke{' '}
            <span className="font-bold text-slate-900">1 nomor Mote</span>. Tidak ada tamu yang
            menerimanya.
          </p>
        ) : (
          <p className="text-sm text-slate-600">
            <span className="text-xl font-bold text-slate-900">{angka(hasil.akan_dikirim)}</span>{' '}
            dari {angka(hasil.total_audience)} tamu akan menerima pesan ini.
          </p>
        )}

        {biaya !== null && (
          <p className="mt-2 text-sm text-slate-600">
            Perkiraan biaya sekitar{' '}
            <span className="font-bold text-slate-900">Rp {angka(biaya)}</span> untuk{' '}
            {angka(hasil.akan_dikirim)} tamu.
          </p>
        )}

        {!modeUji && rincianDibuang.length > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Tamu yang dilewati
            </p>
            <ul className="space-y-1">
              {rincianDibuang.map((l) => (
                <li key={l.kunci} className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{l.teks}</span>
                  <span className="font-semibold text-slate-700">{angka(hasil.dibuang[l.kunci])}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <button onClick={onLanjut} className="btn-primary mt-5">
        Lanjut
      </button>
    </div>
  )
}
