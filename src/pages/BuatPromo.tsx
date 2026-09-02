import { useEffect, useState, type FormEvent } from 'react'
import { api, ApiError } from '../lib/api'
import WhatsappBubble from '../components/WhatsappBubble'
import type { PromoBaruApi } from '../types'

const PANJANG_ISI_MIN = 30
const PANJANG_ISI_MAKS = 1024

const LABEL_STATUS: Record<string, string> = {
  APPROVED: 'Siap dipakai',
  PENDING: 'Sedang diperiksa WhatsApp',
  REJECTED: 'Ditolak WhatsApp',
}

function warnaBadge(status: string): string {
  if (status === 'APPROVED') return 'bg-[#96CD50]/25 text-[#1a3a2a]'
  if (status === 'PENDING') return 'bg-amber-100 text-amber-700'
  if (status === 'REJECTED') return 'bg-red-100 text-red-700'
  return 'bg-slate-100 text-slate-500'
}

const NAMA_BULAN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
]

function tanggalIndo(iso: string | null): string {
  if (!iso) return 'tidak dibatasi'
  const [tahun, bulan, tanggal] = iso.split('-')
  const nama = NAMA_BULAN[Number(bulan) - 1] ?? bulan
  return `${Number(tanggal)} ${nama} ${tahun}`
}

/** Hari ini di zona Asia/Jakarta -- sama dengan yang dipakai server buat validasi tanggal. */
function hariIniJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

interface FormState {
  nama: string
  ringkas: string
  isi: string
  footer: string
  tombolTipe: 'situs' | 'balasan'
  tombolTeks: string
  tombolUrl: string
  berlakuSampai: string
}

const FORM_KOSONG: FormState = {
  nama: '',
  ringkas: '',
  isi: '',
  footer: '',
  tombolTipe: 'situs',
  tombolTeks: '',
  tombolUrl: '',
  berlakuSampai: '',
}

/**
 * Validasi persis aturan server (KONTRAK-BUAT-PROMO.md), dijalankan lagi di sini
 * supaya staf tahu salahnya sebelum promo sungguhan diajukan ke WhatsApp -- server
 * tetap jadi penjaga terakhir, ini cuma percepat umpan baliknya.
 */
function validasiKlien(f: FormState): string | null {
  const nama = f.nama.trim()
  if (nama.length < 3) return 'Nama promo terlalu pendek.'
  if (nama.length > 60) return 'Nama promo terlalu panjang, maksimal 60 huruf.'

  if (f.ringkas.trim().length > 120) return 'Keterangan singkat maksimal 120 huruf.'

  const isi = f.isi.trim()
  if (isi.length < PANJANG_ISI_MIN) return 'Isi pesan terlalu pendek.'
  if (isi.length > PANJANG_ISI_MAKS) return 'Isi pesan maksimal 1.024 huruf.'
  if (isi.includes('{{') || isi.includes('}}')) {
    return 'Isi pesan tidak boleh memakai tanda {{ }}. Tulis kalimatnya lengkap.'
  }

  if (f.footer.trim().length > 60) return 'Footer maksimal 60 huruf.'

  const teksTombol = f.tombolTeks.trim()
  if (teksTombol.length < 1 || teksTombol.length > 25) {
    return 'Tulisan tombol wajib diisi, maksimal 25 huruf.'
  }

  if (f.tombolTipe === 'situs') {
    const url = f.tombolUrl.trim()
    if (!url.startsWith('https://')) return 'Link tombol harus diawali https://'
    if (url.includes('wa.me') || url.includes('api.whatsapp.com')) {
      return 'WhatsApp tidak mengizinkan link wa.me dipakai sebagai tombol. Pakai link website, atau ganti tombolnya jadi tombol balasan.'
    }
  }

  if (!f.berlakuSampai || f.berlakuSampai < hariIniJakarta()) {
    return 'Masa berlaku wajib diisi, dan tidak boleh tanggal yang sudah lewat.'
  }

  return null
}

type MuatanDaftar =
  | { status: 'memuat' }
  | { status: 'gagal'; pesan: string }
  | { status: 'siap'; data: PromoBaruApi[] }

export default function BuatPromo({ onSesiHabis }: { onSesiHabis: () => void }) {
  const [form, setForm] = useState<FormState>(FORM_KOSONG)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sukses, setSukses] = useState(false)

  const [daftar, setDaftar] = useState<MuatanDaftar>({ status: 'memuat' })

  function muatDaftar() {
    setDaftar({ status: 'memuat' })
    api
      .promoBaruList()
      .then((r) => setDaftar({ status: 'siap', data: r.promos }))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) return onSesiHabis()
        setDaftar({
          status: 'gagal',
          pesan: err instanceof Error ? err.message : 'Gagal memuat daftar promo.',
        })
      })
  }

  // eslint-disable-next-line
  useEffect(muatDaftar, [])

  function ubah<K extends keyof FormState>(kunci: K, nilai: FormState[K]) {
    setForm((f) => ({ ...f, [kunci]: nilai }))
    setSukses(false)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')

    const pesanSalah = validasiKlien(form)
    if (pesanSalah) {
      setError(pesanSalah)
      return
    }

    setBusy(true)
    try {
      await api.promoBaru({
        nama: form.nama.trim(),
        ringkas: form.ringkas.trim(),
        isi: form.isi.trim(),
        footer: form.footer.trim(),
        tombol: {
          tipe: form.tombolTipe,
          teks: form.tombolTeks.trim(),
          url: form.tombolTipe === 'situs' ? form.tombolUrl.trim() : '',
        },
        berlaku_sampai: form.berlakuSampai,
      })
      setForm(FORM_KOSONG)
      setSukses(true)
      muatDaftar()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onSesiHabis()
      setError(err instanceof Error ? err.message : 'Gagal membuat promo.')
    } finally {
      setBusy(false)
    }
  }

  const tombolPratinjau =
    form.tombolTeks.trim().length > 0
      ? [{ teks: form.tombolTeks.trim(), tipe: form.tombolTipe }]
      : []

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-lg font-bold text-slate-900">Buat Promo</h1>
      <p className="mb-4 text-sm text-slate-500">
        Promo ini langsung diajukan ke WhatsApp begitu dikirim, jadi pastikan tulisannya sudah
        final sebelum menekan tombol di bawah.
      </p>

      {sukses && (
        <div className="mb-4 rounded-xl bg-[#96CD50]/15 px-4 py-3">
          <p className="text-sm font-semibold text-[#1a3a2a]">
            Promo sudah dikirim ke WhatsApp untuk diperiksa.
          </p>
          <p className="mt-1 text-xs text-[#1a3a2a]/80">
            Biasanya kelar di bawah 1 jam. Begitu disetujui, promo ini muncul sendiri di daftar
            Kirim Promo.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <form onSubmit={submit} className="card min-w-0 flex-1 space-y-4 p-4">
          <div>
            <label htmlFor="nama" className="mb-1.5 block text-sm font-medium text-slate-700">
              Nama promo
            </label>
            <input
              id="nama"
              value={form.nama}
              onChange={(e) => ubah('nama', e.target.value)}
              maxLength={60}
              placeholder="Promo Akhir Tahun 2026"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-brand-400 focus:bg-white"
            />
            <p className="mt-1 text-xs text-slate-400">Buat staf saja, tamu tidak melihat nama ini.</p>
          </div>

          <div>
            <label htmlFor="ringkas" className="mb-1.5 block text-sm font-medium text-slate-700">
              Keterangan singkat (boleh kosong)
            </label>
            <input
              id="ringkas"
              value={form.ringkas}
              onChange={(e) => ubah('ringkas', e.target.value)}
              maxLength={120}
              placeholder="Muncul di kartu promo saat memilih promo untuk dikirim"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-brand-400 focus:bg-white"
            />
          </div>

          <div>
            <label htmlFor="isi" className="mb-1.5 block text-sm font-medium text-slate-700">
              Isi pesan
            </label>
            <textarea
              id="isi"
              value={form.isi}
              onChange={(e) => ubah('isi', e.target.value)}
              maxLength={PANJANG_ISI_MAKS}
              rows={6}
              placeholder="Tulis kalimat lengkap, seperti yang mau dibaca tamu."
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-brand-400 focus:bg-white"
            />
            <div className="mt-1 flex justify-between text-xs text-slate-400">
              <span>Minimal {PANJANG_ISI_MIN} huruf. Jangan pakai tanda {'{{ }}'}.</span>
              <span>
                {form.isi.length}/{PANJANG_ISI_MAKS}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="footer" className="mb-1.5 block text-sm font-medium text-slate-700">
              Footer (boleh kosong)
            </label>
            <input
              id="footer"
              value={form.footer}
              onChange={(e) => ubah('footer', e.target.value)}
              maxLength={60}
              placeholder="Kampung Sumber Alam"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-brand-400 focus:bg-white"
            />
          </div>

          <div>
            <p className="mb-1.5 block text-sm font-medium text-slate-700">Tombol pesan</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => ubah('tombolTipe', 'situs')}
                className={
                  'min-h-[48px] rounded-xl border-2 px-3 text-sm font-medium ' +
                  (form.tombolTipe === 'situs'
                    ? 'border-[#1a3a2a] bg-[#1a3a2a]/5 text-[#1a3a2a]'
                    : 'border-slate-200 text-slate-500')
                }
              >
                Buka link website
              </button>
              <button
                type="button"
                onClick={() => ubah('tombolTipe', 'balasan')}
                className={
                  'min-h-[48px] rounded-xl border-2 px-3 text-sm font-medium ' +
                  (form.tombolTipe === 'balasan'
                    ? 'border-[#1a3a2a] bg-[#1a3a2a]/5 text-[#1a3a2a]'
                    : 'border-slate-200 text-slate-500')
                }
              >
                Tombol balasan cepat
              </button>
            </div>

            {form.tombolTipe === 'situs' && (
              <>
                <label htmlFor="tombolUrl" className="mb-1.5 mt-3 block text-sm font-medium text-slate-700">
                  Link yang dibuka tombol
                </label>
                <input
                  id="tombolUrl"
                  value={form.tombolUrl}
                  onChange={(e) => ubah('tombolUrl', e.target.value)}
                  placeholder="https://motekreatif.com/promo"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-brand-400 focus:bg-white"
                />
              </>
            )}

            <label htmlFor="tombolTeks" className="mb-1.5 mt-3 block text-sm font-medium text-slate-700">
              Tulisan di tombol
            </label>
            <input
              id="tombolTeks"
              value={form.tombolTeks}
              onChange={(e) => ubah('tombolTeks', e.target.value)}
              maxLength={25}
              placeholder={form.tombolTipe === 'situs' ? 'Lihat Promo' : 'Saya Mau Tanya'}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-brand-400 focus:bg-white"
            />
            <p className="mt-1 text-xs text-slate-400">Tulisan yang tamu lihat di tombolnya, maksimal 25 huruf.</p>
          </div>

          <div>
            <label htmlFor="berlaku" className="mb-1.5 block text-sm font-medium text-slate-700">
              Berlaku sampai
            </label>
            <input
              id="berlaku"
              type="date"
              value={form.berlakuSampai}
              min={hariIniJakarta()}
              onChange={(e) => ubah('berlakuSampai', e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-brand-400 focus:bg-white"
            />
          </div>

          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? 'Mengirim ke WhatsApp...' : 'Ajukan promo ke WhatsApp'}
          </button>
        </form>

        <div className="w-full shrink-0 md:w-72">
          <p className="mb-2 text-xs font-semibold text-slate-500">Tampilan promo di WhatsApp tamu</p>
          <div className="rounded-2xl bg-[#0b141a] p-3">
            <WhatsappBubble
              isiPesan={form.isi.trim() || 'Isi pesan promo akan muncul di sini.'}
              footer={form.footer.trim()}
              gambarUrl=""
              tombol={tombolPratinjau}
            />
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-bold text-slate-900">Promo yang sudah diajukan</h2>

        {daftar.status === 'memuat' && (
          <div className="card flex flex-col items-center gap-3 p-6 text-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-[#1a3a2a]" />
            <p className="text-sm text-slate-500">Memuat daftar promo...</p>
          </div>
        )}

        {daftar.status === 'gagal' && (
          <div className="card space-y-3 p-5 text-center">
            <p className="text-sm text-slate-600">{daftar.pesan}</p>
            <button onClick={muatDaftar} className="btn-ghost mx-auto">
              Coba lagi
            </button>
          </div>
        )}

        {daftar.status === 'siap' && daftar.data.length === 0 && (
          <div className="card p-5 text-center">
            <p className="text-sm text-slate-500">Belum ada promo yang diajukan dari sini.</p>
          </div>
        )}

        {daftar.status === 'siap' && daftar.data.length > 0 && (
          <div className="space-y-2">
            {daftar.data.map((p) => (
              <div key={p.template} className="card flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{p.nama}</p>
                  {p.ringkas && <p className="truncate text-xs text-slate-500">{p.ringkas}</p>}
                  <p className="text-xs text-slate-400">Berlaku sampai {tanggalIndo(p.berlaku_sampai)}</p>
                </div>
                <span
                  className={
                    'shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ' +
                    warnaBadge(p.status)
                  }
                >
                  {LABEL_STATUS[p.status] ?? (p.status || 'Status tidak diketahui')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
