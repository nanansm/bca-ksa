import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { DashboardApi, DashboardHarian, Progres, StatusRun } from '../types'

const angka = (n: number) => new Intl.NumberFormat('id-ID').format(n)
const rupiah = (n: number) => 'Rp' + new Intl.NumberFormat('id-ID').format(n)

function formatWaktu(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

// Judul status dalam bahasa manusia. Sengaja diduplikasi kecil dari
// Step5Progres.tsx (bukan diimpor) supaya halaman progres pengiriman tidak
// ikut disentuh oleh kerjaan dashboard ini.
const JUDUL_STATUS: Record<StatusRun, string> = {
  menyiapkan: 'Menyiapkan daftar tamu',
  jalan: 'Sedang mengirim',
  selesai: 'Selesai',
  dihentikan: 'Dihentikan paksa',
  dihentikan_batas: 'Berhenti karena batas harian WhatsApp',
  terputus: 'Terputus, tidak ada kabar',
  gagal_mulai: 'Gagal dimulai',
}

type WarnaLampu = 'hijau' | 'kuning' | 'merah' | 'abu'

const WARNA_DOT: Record<WarnaLampu, string> = {
  hijau: 'bg-green-500',
  kuning: 'bg-amber-400',
  merah: 'bg-red-500',
  abu: 'bg-slate-300',
}

// Meta memakai istilah GREEN/YELLOW/RED buat "quality rating" nomor. Staf
// hotel tidak perlu tahu istilah itu — cukup lampu warna + kalimat manusia.
function bacaKualitas(kualitas: string): { warna: WarnaLampu; judul: string; penjelasan: string } {
  switch (kualitas.toUpperCase()) {
    case 'GREEN':
      return {
        warna: 'hijau',
        judul: 'Sehat',
        penjelasan: 'Nomor dipercaya WhatsApp. Pengiriman promo aman berjalan seperti biasa.',
      }
    case 'YELLOW':
      return {
        warna: 'kuning',
        judul: 'Mulai diwaspadai',
        penjelasan:
          'WhatsApp mulai memperketat nomor ini. Kurangi jumlah tamu yang dikirimi dan pantau pesan yang gagal.',
      }
    case 'RED':
      return {
        warna: 'merah',
        judul: 'Bermasalah',
        penjelasan: 'WhatsApp membatasi nomor ini. Hubungi Mote dulu sebelum kirim promo lagi.',
      }
    default:
      return {
        warna: 'abu',
        judul: 'Belum diketahui',
        penjelasan: 'Status kesehatan nomor belum bisa diambil saat ini.',
      }
  }
}

// Status akun WhatsApp dari Meta (CONNECTED/FLAGGED/dll) — kalau ada
// istilah yang kita kenal, jelaskan; kalau tidak, tampilkan apa adanya.
const STATUS_NOMOR: Record<string, string> = {
  CONNECTED: 'Terhubung dan siap kirim pesan.',
  FLAGGED: 'Ditandai WhatsApp — perhatikan lampu kesehatan di atas.',
  RESTRICTED: 'Dibatasi WhatsApp, sebagian pengiriman bisa gagal.',
  PENDING: 'Masih diproses WhatsApp.',
  DISCONNECTED: 'Terputus dari WhatsApp, hubungi Mote.',
}

function Kartu({ judul, nilai, sub }: { judul: string; nilai: string; sub: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-slate-500">{judul}</p>
      <p className="mt-1 break-words text-lg font-bold text-slate-900">{nilai}</p>
      <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>
    </div>
  )
}

// Grafik SVG murni, tanpa pustaka. Lebar kanvas dihitung dari jumlah hari
// supaya tiap titik dapat ruang cukup — kalau kepanjangan buat layar sempit,
// yang scroll cukup div pembungkusnya (overflow-x-auto), bukan halamannya.
function GrafikHarian({ data }: { data: DashboardHarian[] }) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        Grafik belum bisa diambil dari WhatsApp saat ini.
      </p>
    )
  }

  const tinggiTotal = 150
  const tinggiPlot = 108
  const lebarPerHari = 26
  const kiriKosong = 8
  const lebarSvg = kiriKosong + data.length * lebarPerHari + 12
  const nilaiMaks = Math.max(1, ...data.map((h) => Math.max(h.terkirim, h.sampai)))

  const posisiX = (i: number) => kiriKosong + i * lebarPerHari + lebarPerHari / 2
  const posisiY = (nilai: number) => tinggiPlot - (nilai / nilaiMaks) * (tinggiPlot - 10)

  const garis = (kunci: 'terkirim' | 'sampai') =>
    data.map((h, i) => `${posisiX(i)},${posisiY(h[kunci])}`).join(' ')

  // Cuma tampilkan sebagian label tanggal (awal, akhir, tiap 5 hari) biar
  // tidak numpuk berdempetan di sumbu-x.
  const tampilkanLabel = (i: number) => i === 0 || i === data.length - 1 || i % 5 === 0

  return (
    <div className="overflow-x-auto">
      <svg width={lebarSvg} height={tinggiTotal} className="block">
        <line
          x1={kiriKosong}
          y1={tinggiPlot}
          x2={lebarSvg - 4}
          y2={tinggiPlot}
          stroke="#e2e8f0"
          strokeWidth={1}
        />
        <polyline points={garis('terkirim')} fill="none" stroke="#eab308" strokeWidth={2} />
        <polyline points={garis('sampai')} fill="none" stroke="#1a3a2a" strokeWidth={2} />
        {data.map((h, i) => {
          if (!tampilkanLabel(i)) return null
          const [, bulan, tgl] = h.tanggal.split('-')
          return (
            <text
              key={h.tanggal}
              x={posisiX(i)}
              y={tinggiPlot + 16}
              fontSize={9}
              textAnchor="middle"
              fill="#94a3b8"
            >
              {`${Number(tgl)}/${Number(bulan)}`}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

function JatahHariIni({ hariIni }: { hariIni: DashboardApi['hari_ini'] }) {
  const total = hariIni.batas_harian > 0 ? hariIni.batas_harian : 1
  const persen = Math.min(100, (hariIni.terkirim / total) * 100)
  return (
    <div className="card p-5">
      <p className="mb-3 text-sm font-semibold text-slate-700">Jatah kirim hari ini</p>
      <div className="mb-2 h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-400" style={{ width: `${persen}%` }} />
      </div>
      <p className="text-sm text-slate-600">
        <span className="font-bold text-slate-900">{angka(hariIni.terkirim)}</span> nomor sudah
        dikirimi hari ini, sisa{' '}
        <span className="font-bold text-slate-900">{angka(hariIni.sisa_kuota)}</span> dari jatah{' '}
        {angka(hariIni.batas_harian)} nomor per hari.
      </p>
    </div>
  )
}

function RiwayatRun({ runs }: { runs: Progres[] }) {
  if (runs.length === 0) {
    return <p className="text-sm text-slate-500">Belum ada riwayat pengiriman.</p>
  }
  return (
    <ul className="divide-y divide-slate-100">
      {runs.map((r) => (
        <li key={r.runId} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{r.promo}</p>
            <p className="text-xs text-slate-500">
              {JUDUL_STATUS[r.status]} · {formatWaktu(r.diperbarui)}
            </p>
          </div>
          <p className="shrink-0 text-sm font-medium text-slate-600">
            {angka(r.terkirim)}/{angka(r.target)}
          </p>
        </li>
      ))}
    </ul>
  )
}

type Muatan =
  | { status: 'memuat' }
  | { status: 'gagal'; pesan: string }
  | { status: 'siap'; data: DashboardApi }

export default function Dashboard({ onSesiHabis }: { onSesiHabis: () => void }) {
  const [muatan, setMuatan] = useState<Muatan>({ status: 'memuat' })

  function muat() {
    setMuatan({ status: 'memuat' })
    api
      .dashboard()
      .then((data) => setMuatan({ status: 'siap', data }))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) return onSesiHabis()
        setMuatan({
          status: 'gagal',
          pesan: err instanceof Error ? err.message : 'Gagal memuat dashboard.',
        })
      })
  }

  useEffect(muat, [])

  if (muatan.status === 'memuat') {
    return (
      <div className="card flex flex-col items-center gap-3 p-8 text-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-[#1a3a2a]" />
        <p className="text-sm text-slate-500">Memuat dashboard…</p>
      </div>
    )
  }

  if (muatan.status === 'gagal') {
    return (
      <div className="card space-y-3 p-6 text-center">
        <p className="text-sm text-slate-600">{muatan.pesan}</p>
        <button onClick={muat} className="btn-ghost mx-auto">
          Coba lagi
        </button>
      </div>
    )
  }

  const d = muatan.data
  // Backend menandai sendiri bagian mana yang gagal diambil dari Meta lewat `gagal`.
  // Bagian lain dashboard tetap tampil seperti biasa, jangan bikin halaman kosong.
  const nomorGagal = (d.gagal ?? []).some((g) => g.startsWith('nomor'))
  const kes = bacaKualitas(d.nomor.kualitas)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Dashboard</h1>
        <p className="text-xs text-slate-400">Data terakhir diperbarui {formatWaktu(d.diperbarui)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kartu judul="Terkirim bulan ini" nilai={angka(d.bulan_ini.terkirim)} sub="pesan promo" />
        <Kartu
          judul="Sampai ke HP tamu"
          nilai={d.bulan_ini.sampai === null ? 'Belum ada datanya' : angka(d.bulan_ini.sampai)}
          sub={d.bulan_ini.sampai === null ? 'pelacakan baru mulai berjalan' : 'pesan promo'}
        />
        <Kartu
          judul="Dibaca"
          nilai={d.bulan_ini.dibaca === null ? 'Belum ada datanya' : angka(d.bulan_ini.dibaca)}
          sub={d.bulan_ini.dibaca === null ? 'pelacakan baru mulai berjalan' : 'pesan promo'}
        />
        <Kartu
          judul={d.bulan_ini.biaya_asli ? 'Tagihan Meta bulan ini' : 'Perkiraan biaya'}
          nilai={rupiah(d.bulan_ini.biaya)}
          sub={d.bulan_ini.biaya_asli ? 'angka asli dari WhatsApp' : 'perkiraan, bukan tagihan pasti'}
        />
      </div>

      <div className="card p-5">
        <p className="mb-3 text-sm font-semibold text-slate-700">Kesehatan nomor WhatsApp</p>
        {nomorGagal ? (
          <p className="text-sm text-slate-500">
            Data kesehatan nomor sedang tidak bisa diambil dari WhatsApp.
          </p>
        ) : (
          <div className="flex items-start gap-3">
            <span className={'mt-1 h-3 w-3 shrink-0 rounded-full ' + WARNA_DOT[kes.warna]} />
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">
                {kes.judul} — {d.nomor.display}
              </p>
              <p className="mt-0.5 text-sm text-slate-600">{kes.penjelasan}</p>
              {d.nomor.status && (
                <p className="mt-1 text-xs text-slate-400">
                  {STATUS_NOMOR[d.nomor.status.toUpperCase()] ?? `Status akun: ${d.nomor.status}`}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="card p-5">
        <p className="text-sm font-semibold text-slate-700">Lalu lintas pesan 30 hari terakhir</p>
        <p className="mb-3 text-xs text-slate-400">
          Semua pesan nomor WhatsApp KSA, termasuk balasan ke tamu yang chat sendiri — bukan
          promo saja.
        </p>
        <GrafikHarian data={d.harian} />
        {d.harian.length > 0 && (
          <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#eab308]" />
              Terkirim
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#1a3a2a]" />
              Sampai ke HP tamu
            </span>
          </div>
        )}
      </div>

      <JatahHariIni hariIni={d.hari_ini} />

      <div className="card p-5">
        <p className="mb-3 text-sm font-semibold text-slate-700">Riwayat pengiriman terakhir</p>
        <RiwayatRun runs={d.run_terakhir} />
      </div>
    </div>
  )
}
