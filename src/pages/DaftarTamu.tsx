import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { api, ApiError } from '../lib/api'
import { bacaBaris, type HasilBaca } from '../lib/nomor'
import type { DaftarApi } from '../types'

const angka = (n: number) => new Intl.NumberFormat('id-ID').format(n)
const POTONGAN = 500

function hariIniJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

function tanggalIndo(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(d)
}

interface FormState {
  nama: string
  periode: string
  checkoutTerakhir: string
}

const FORM_KOSONG: FormState = { nama: '', periode: '', checkoutTerakhir: '' }

type MuatanDaftar =
  | { status: 'memuat' }
  | { status: 'gagal'; pesan: string }
  | { status: 'siap'; data: DaftarApi[] }

function BarisLaporan({ label, nilai }: { label: string; nilai: string }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-1.5 pr-3 text-slate-500">{label}</td>
      <td className="py-1.5 text-right font-semibold text-slate-900">{nilai}</td>
    </tr>
  )
}

export default function DaftarTamu({ onSesiHabis }: { onSesiHabis: () => void }) {
  const [form, setForm] = useState<FormState>(FORM_KOSONG)
  const [membaca, setMembaca] = useState(false)
  const [bacaError, setBacaError] = useState('')
  const [hasil, setHasil] = useState<HasilBaca | null>(null)
  const inputFileRef = useRef<HTMLInputElement>(null)

  const [menyimpan, setMenyimpan] = useState(false)
  const [progresSimpan, setProgresSimpan] = useState<{ dikirim: number; total: number } | null>(null)
  const [simpanError, setSimpanError] = useState('')
  const [sukses, setSukses] = useState(false)

  const [daftar, setDaftar] = useState<MuatanDaftar>({ status: 'memuat' })
  const [konfirmasiHapus, setKonfirmasiHapus] = useState<string | null>(null)
  const hapusTimerRef = useRef<number | null>(null)

  function muatDaftar() {
    setDaftar({ status: 'memuat' })
    api
      .daftarList()
      .then((r) => setDaftar({ status: 'siap', data: r.daftar }))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) return onSesiHabis()
        setDaftar({ status: 'gagal', pesan: err instanceof Error ? err.message : 'Gagal memuat daftar.' })
      })
  }

  // eslint-disable-next-line
  useEffect(muatDaftar, [])

  function ubah<K extends keyof FormState>(kunci: K, nilai: FormState[K]) {
    setForm((f) => ({ ...f, [kunci]: nilai }))
    setSukses(false)
  }

  async function pilihFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setBacaError('')
    setHasil(null)
    setSimpanError('')
    setSukses(false)
    setMembaca(true)
    try {
      // Dynamic import supaya `xlsx` tidak ikut terbawa di bundel halaman lain.
      const XLSX = await import('xlsx')
      const buku = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const sheet = buku.Sheets[buku.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      setHasil(bacaBaris(rows))
    } catch (err) {
      setBacaError(err instanceof Error ? err.message : 'File tidak terbaca.')
    } finally {
      setMembaca(false)
    }
  }

  function validasiForm(): string | null {
    const nama = form.nama.trim()
    if (nama.length < 3) return 'Nama daftar terlalu pendek.'
    if (nama.length > 60) return 'Nama daftar terlalu panjang, maksimal 60 huruf.'
    if (!form.periode.trim()) return 'Periode menginap wajib diisi.'
    if (form.periode.trim().length > 60) return 'Periode menginap maksimal 60 huruf.'
    return null
  }

  async function simpan() {
    if (!hasil) return
    const pesanSalah = validasiForm()
    if (pesanSalah) {
      setSimpanError(pesanSalah)
      return
    }

    setSimpanError('')
    setMenyimpan(true)
    setProgresSimpan({ dikirim: 0, total: hasil.nomor.length })

    try {
      const mulai = await api.daftarMulai({
        nama: form.nama.trim(),
        periode: form.periode.trim(),
        checkout_terakhir: form.checkoutTerakhir,
      })

      // Dipecah per 500 nomor supaya satu request tidak pernah membawa 12 ribu nomor
      // sekaligus -- lihat KONTRAK-DAFTAR-TAMU.md. Gagal di tengah = daftar tetap
      // siap=0 di server dan tidak pernah muncul di mana pun.
      for (let i = 0; i < hasil.nomor.length; i += POTONGAN) {
        const potongan = hasil.nomor.slice(i, i + POTONGAN)
        await api.daftarTambah(mulai.id, potongan)
        setProgresSimpan({ dikirim: Math.min(i + POTONGAN, hasil.nomor.length), total: hasil.nomor.length })
      }

      await api.daftarSelesai(mulai.id)

      setSukses(true)
      setForm(FORM_KOSONG)
      setHasil(null)
      if (inputFileRef.current) inputFileRef.current.value = ''
      muatDaftar()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onSesiHabis()
      setSimpanError(err instanceof Error ? err.message : 'Gagal menyimpan daftar.')
    } finally {
      setMenyimpan(false)
      setProgresSimpan(null)
    }
  }

  function hapus(id: string) {
    if (konfirmasiHapus !== id) {
      setKonfirmasiHapus(id)
      if (hapusTimerRef.current !== null) window.clearTimeout(hapusTimerRef.current)
      // Konfirmasi otomatis batal kalau tidak diketuk lagi dalam 4 detik.
      hapusTimerRef.current = window.setTimeout(() => setKonfirmasiHapus(null), 4000)
      return
    }

    if (hapusTimerRef.current !== null) window.clearTimeout(hapusTimerRef.current)
    setKonfirmasiHapus(null)
    api
      .daftarHapus(id)
      .then(muatDaftar)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) onSesiHabis()
      })
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-lg font-bold text-slate-900">Daftar Tamu</h1>
      <p className="mb-4 text-sm text-slate-500">
        Unggah ekspor reservasi buat menyasar promo ke sekelompok tamu tertentu, misalnya yang
        menginap di periode tertentu saja.
      </p>

      {sukses && (
        <div className="mb-4 rounded-xl bg-[#96CD50]/15 px-4 py-3">
          <p className="text-sm font-semibold text-[#1a3a2a]">
            Daftar tersimpan dan sudah bisa dipilih sebagai penerima di Kirim Promo.
          </p>
        </div>
      )}

      <div className="card space-y-4 p-4">
        <div>
          <label htmlFor="namaDaftar" className="mb-1.5 block text-sm font-medium text-slate-700">
            Nama daftar
          </label>
          <input
            id="namaDaftar"
            value={form.nama}
            onChange={(e) => ubah('nama', e.target.value)}
            maxLength={60}
            placeholder="Tamu Agustus 2026"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-brand-400 focus:bg-white"
          />
        </div>

        <div>
          <label htmlFor="periode" className="mb-1.5 block text-sm font-medium text-slate-700">
            Periode menginap
          </label>
          <input
            id="periode"
            value={form.periode}
            onChange={(e) => ubah('periode', e.target.value)}
            maxLength={60}
            placeholder="Tamu menginap Agustus 2026"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-brand-400 focus:bg-white"
          />
        </div>

        <div>
          <label htmlFor="checkout" className="mb-1.5 block text-sm font-medium text-slate-700">
            Tanggal check-out terakhir (boleh kosong)
          </label>
          <input
            id="checkout"
            type="date"
            value={form.checkoutTerakhir}
            max={hariIniJakarta()}
            onChange={(e) => ubah('checkoutTerakhir', e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-brand-400 focus:bg-white"
          />
        </div>

        <div>
          <label htmlFor="file" className="mb-1.5 block text-sm font-medium text-slate-700">
            File ekspor reservasi (.xlsx / .csv)
          </label>
          <input
            id="file"
            ref={inputFileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={pilihFile}
            className="w-full text-sm text-slate-600 file:mr-3 file:min-h-[44px] file:rounded-xl file:border-0 file:bg-[#1a3a2a]/10 file:px-4 file:py-3 file:text-sm file:font-medium file:text-[#1a3a2a]"
          />
          <p className="mt-1 text-xs text-slate-400">
            File dibaca di HP/laptop ini saja -- yang dikirim ke server cuma nomor yang sudah bersih.
          </p>
        </div>

        {membaca && <p className="text-sm text-slate-500">Membaca file…</p>}

        {bacaError && (
          <div className="rounded-xl bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">{bacaError}</p>
          </div>
        )}

        {hasil && (
          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <table className="w-full text-sm">
              <tbody>
                <BarisLaporan label="Kolom nomor yang dipakai" nilai={hasil.kolomNomor} />
                <BarisLaporan label="Kolom nama yang dipakai" nilai={hasil.kolomNama ?? '(tidak ada)'} />
                <BarisLaporan label="Baris di file" nilai={angka(hasil.barisFile)} />
                <BarisLaporan label="Nomor terbaca" nilai={angka(hasil.terbaca)} />
                <BarisLaporan label="Dobel di dalam file" nilai={angka(hasil.dobelDiFile)} />
                <BarisLaporan label="Format nomor rusak" nilai={angka(hasil.rusak)} />
                <BarisLaporan label="Kolom nomor kosong" nilai={angka(hasil.kosong)} />
              </tbody>
            </table>
            <p className="text-xs text-slate-500">
              Periksa baris "kolom nomor yang dipakai". Kalau salah kolom, ganti judul kolomnya jadi{' '}
              <span className="font-mono">nomor</span> di file lalu unggah lagi.
            </p>

            {simpanError && (
              <div className="rounded-xl bg-red-50 px-4 py-3">
                <p className="text-sm text-red-700">{simpanError}</p>
              </div>
            )}

            {progresSimpan && (
              <p className="text-center text-sm text-slate-600">
                Menyimpan {angka(progresSimpan.dikirim)} dari {angka(progresSimpan.total)} nomor…
              </p>
            )}

            <button onClick={simpan} disabled={menyimpan || hasil.terbaca === 0} className="btn-primary w-full">
              {menyimpan ? 'Menyimpan…' : 'Simpan daftar ini'}
            </button>
          </div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-bold text-slate-900">Daftar tersimpan</h2>

        {daftar.status === 'memuat' && (
          <div className="card flex flex-col items-center gap-3 p-6 text-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-[#1a3a2a]" />
            <p className="text-sm text-slate-500">Memuat daftar…</p>
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
            <p className="text-sm text-slate-500">Belum ada daftar tersimpan.</p>
          </div>
        )}

        {daftar.status === 'siap' && daftar.data.length > 0 && (
          <div className="space-y-2">
            {daftar.data.map((d) => (
              <div key={d.id} className="card flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{d.nama}</p>
                  <p className="truncate text-xs text-slate-500">{d.periode}</p>
                  <p className="text-xs text-slate-400">
                    {angka(d.jumlah)} nomor · dibuat {tanggalIndo(d.dibuat)}
                  </p>
                </div>
                <button
                  onClick={() => hapus(d.id)}
                  className={
                    'min-h-[36px] shrink-0 whitespace-nowrap rounded-lg px-3 text-xs font-semibold ' +
                    (konfirmasiHapus === d.id ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600')
                  }
                >
                  {konfirmasiHapus === d.id ? 'Yakin, hapus?' : 'Hapus'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
