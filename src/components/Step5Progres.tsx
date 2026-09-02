import type { Progres, StatusRun } from '../types'

const angka = (n: number) => new Intl.NumberFormat('id-ID').format(n)

const JUDUL: Record<StatusRun, string> = {
  menyiapkan: 'Menyiapkan daftar tamu',
  jalan: 'Sedang mengirim',
  selesai: 'Pengiriman selesai',
  dihentikan: 'Pengiriman dihentikan',
  dihentikan_batas: 'Kena batas kirim harian',
  terputus: 'Pengiriman terputus',
  gagal_mulai: 'Pengiriman gagal dimulai',
}

// Status yang masih berjalan di latar belakang — tombol "kirim promo lain"
// baru muncul kalau run sudah keluar dari kedua status ini.
const MASIH_JALAN: StatusRun[] = ['menyiapkan', 'jalan']

export default function Step5Progres({
  progres,
  error,
  onMulaiBaru,
}: {
  progres: Progres | null
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

  const belumJalan = progres.status === 'menyiapkan'
  const persen = progres.target > 0 ? Math.min(100, (progres.terkirim / progres.target) * 100) : 0
  // Kalau statusnya masih "jalan" tapi kabar terakhir sudah lama, kemungkinan
  // mesin pengirim (n8n) telat lapor — bukan berarti pengirimannya berhenti.
  const kabarTerlambat =
    progres.status === 'jalan' &&
    Date.now() - new Date(progres.diperbarui).getTime() > 3 * 60 * 1000
  const bisaMulaiBaru = !MASIH_JALAN.includes(progres.status)
  const sisaBelumDikirim = Math.max(progres.target - progres.terkirim, 0)

  return (
    <div>
      <p className="mb-1 text-center text-sm text-slate-500">{progres.promo}</p>
      <h1 className="mb-6 text-center text-lg font-bold text-slate-900">{JUDUL[progres.status]}</h1>

      {belumJalan ? (
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-[#1a3a2a]" />
          <p className="text-sm text-slate-500">Menyiapkan daftar tamu yang akan menerima pesan…</p>
        </div>
      ) : (
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
          {progres.tertahan > 0 && (
            <p className="mt-1 text-center text-xs text-amber-600">
              {angka(progres.tertahan)} tertahan batas WhatsApp
            </p>
          )}
        </div>
      )}

      {kabarTerlambat && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            Kabar dari mesin pengirim terlambat, sudah lebih dari 3 menit tidak ada pembaruan.
            Kemungkinan masih jalan, coba tunggu sebentar lagi.
          </p>
        </div>
      )}

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

      {progres.status === 'dihentikan_batas' && (
        <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">
            Kena batas kirim harian WhatsApp. {angka(sisaBelumDikirim)} tamu belum menerima pesan.
            Besok bisa dilanjutkan dengan promo yang sama — tamu yang sudah menerima tidak akan
            dikirimi dua kali.
          </p>
        </div>
      )}

      {progres.status === 'terputus' && (
        <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">
            Pengiriman sebelumnya terputus di {angka(progres.terkirim)} dari {angka(progres.target)}{' '}
            tamu.
          </p>
        </div>
      )}

      {progres.status === 'gagal_mulai' && (
        <div className="mt-5 rounded-xl border border-red-300 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">
            Pengiriman gagal dimulai. {progres.alasan || 'Sebab tidak diketahui, hubungi Mote.'}
          </p>
        </div>
      )}

      {bisaMulaiBaru && (
        <button onClick={onMulaiBaru} className="btn-primary mt-5">
          Kirim promo lain
        </button>
      )}
    </div>
  )
}
