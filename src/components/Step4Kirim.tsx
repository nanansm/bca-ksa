import { useState } from 'react'
import HoldButton from './HoldButton'
import type { HitungResult, Maks, PromoApi } from '../types'

const angka = (n: number) => new Intl.NumberFormat('id-ID').format(n)

export default function Step4Kirim({
  promo,
  maks,
  hasil,
  tarifPerPesan,
  onKonfirmasi,
  onBack,
  busy,
  error,
}: {
  promo: PromoApi
  maks: Maks
  hasil: HitungResult
  /** Tarif per pesan dari /api/pengaturan. `null` kalau gagal dimuat. */
  tarifPerPesan: number | null
  onKonfirmasi: () => void
  onBack: () => void
  busy: boolean
  error: string
}) {
  const semuaTamu = maks === 0
  const modeUji = maks === -1
  const biaya = !modeUji && tarifPerPesan !== null ? hasil.akan_dikirim * tarifPerPesan : null
  // Dibulatkan ke bawah — staf ketik angka juta yang tertulis jelas di layar
  // sebagai bukti sudah membaca perkiraan biayanya sebelum kirim ke semua tamu.
  const biayaJuta = biaya !== null ? Math.floor(biaya / 1_000_000) : null

  const [sudahYakin, setSudahYakin] = useState(false) // dipakai kalau biaya tidak diketahui
  const [inputJuta, setInputJuta] = useState('')

  const perluKonfirmasiAngka = semuaTamu && biayaJuta !== null
  const konfirmasiAngkaCocok = perluKonfirmasiAngka && inputJuta.trim() === String(biayaJuta)
  const perluTombolTahan = !semuaTamu || (perluKonfirmasiAngka ? konfirmasiAngkaCocok : sudahYakin)

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
        {biaya !== null && (
          <p className="mt-2 text-sm text-slate-500">
            Perkiraan biaya sekitar <span className="font-semibold text-slate-700">Rp {angka(biaya)}</span>.
          </p>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {semuaTamu && !perluTombolTahan && (
        <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="mb-3 text-sm font-semibold text-amber-800">
            Ini akan mengirim ke SEMUA tamu, bukan sebagian. Pastikan sudah benar sebelum lanjut.
          </p>

          {perluKonfirmasiAngka ? (
            <>
              <p className="mb-2 text-sm text-amber-800">
                Perkiraan biaya sekitar Rp {angka(biaya as number)}. Untuk konfirmasi, ketik angka
                jutanya di kotak ini: <span className="font-bold">{biayaJuta}</span>
              </p>
              <input
                inputMode="numeric"
                value={inputJuta}
                onChange={(e) => setInputJuta(e.target.value)}
                placeholder="Ketik angka juta"
                className="w-full rounded-xl border border-amber-300 bg-white px-4 py-3 text-center text-lg font-bold text-slate-900 outline-none focus:border-[#1a3a2a]"
              />
            </>
          ) : (
            <button onClick={() => setSudahYakin(true)} className="btn-ghost w-full bg-white">
              Saya yakin, kirim ke semua tamu
            </button>
          )}
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
