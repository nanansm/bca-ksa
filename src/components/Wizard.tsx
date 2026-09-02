import { useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../lib/api'
import StepIndicator from './StepIndicator'
import Step1Promo from './Step1Promo'
import Step2Jumlah from './Step2Jumlah'
import Step3Pratinjau from './Step3Pratinjau'
import Step4Kirim from './Step4Kirim'
import Step5Progres from './Step5Progres'
import type { HitungResult, Maks, Progres, PromoApi, ResponPengaturan } from '../types'

type Langkah = 1 | 2 | 3 | 4 | 5

// Status run yang masih dianggap "sedang berjalan" — dipakai buat menentukan
// kapan polling progres boleh berhenti.
const STATUS_JALAN: Progres['status'][] = ['menyiapkan', 'jalan']

export default function Wizard({ onSesiHabis }: { onSesiHabis: () => void }) {
  const [memeriksaRun, setMemeriksaRun] = useState(true)
  const [langkah, setLangkah] = useState<Langkah>(1)

  const [pengaturan, setPengaturan] = useState<ResponPengaturan | null>(null)

  const [promo, setPromo] = useState<PromoApi | null>(null)
  const [maks, setMaks] = useState<Maks | null>(null)
  const [hasil, setHasil] = useState<HitungResult | null>(null)

  const [runId, setRunId] = useState<string | null>(null)
  const [progres, setProgres] = useState<Progres | null>(null)
  const [progresError, setProgresError] = useState('')
  const [busyKirim, setBusyKirim] = useState(false)
  const [kirimError, setKirimError] = useState('')

  const timerRef = useRef<number | null>(null)

  // Sekali saat halaman dibuka: tanya server apakah ada pengiriman yang belum
  // selesai (bukan lagi baca localStorage — sumber kebenarannya D1). Sambil
  // menunggu, tarik juga tarif & sisa kuota buat ditampilkan di langkah 2-4.
  useEffect(() => {
    const cekRun = api
      .runAktif()
      .then((r) => {
        if (r.run) {
          setRunId(r.run.runId)
          setProgres(r.run)
          setLangkah(5)
        }
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          onSesiHabis()
        }
        // Gagal periksa run aktif bukan alasan buat mengunci layar — staf
        // tetap bisa mulai dari langkah 1, kalau ternyata ada run nyangkut
        // nanti kepental balik lewat balasan 409 di /api/kirim.
      })

    const cekPengaturan = api
      .pengaturan()
      .then(setPengaturan)
      .catch(() => {
        /* biarkan null — komponen anak sudah siap tanpa data ini */
      })

    Promise.all([cekRun, cekPengaturan]).finally(() => setMemeriksaRun(false))
    // hanya jalan sekali saat mount
    // eslint-disable-next-line
  }, [])

  // Polling progres tiap 5 detik selama masih di layar 5 dan runnya masih jalan.
  useEffect(() => {
    if (langkah !== 5 || !runId) return
    if (progres && !STATUS_JALAN.includes(progres.status)) return

    timerRef.current = window.setInterval(() => {
      api
        .progress(runId)
        .then((r) => {
          setProgres(r)
          setProgresError('')
        })
        .catch((err: unknown) => {
          if (err instanceof ApiError && err.status === 401) {
            onSesiHabis()
            return
          }
          setProgresError(err instanceof Error ? err.message : 'Gagal memuat progres.')
        })
    }, 5000)

    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current)
    }
  }, [langkah, runId, progres, onSesiHabis])

  async function kirimSekarang() {
    if (!promo || maks === null) return
    setBusyKirim(true)
    setKirimError('')
    try {
      const res = await api.kirim(promo.template, promo.nama, maks)
      setRunId(res.runId)
      setProgres(res)
      setLangkah(5)
      setBusyKirim(false)
      return
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onSesiHabis()
        return
      }

      if (err instanceof ApiError && err.status === 409) {
        const run = (err.data as { run?: Progres } | null)?.run
        if (run) {
          setRunId(run.runId)
          setProgres(run)
          setLangkah(5)
          setBusyKirim(false)
          return
        }
      }

      setKirimError(err instanceof Error ? err.message : 'Gagal memulai pengiriman.')

      // Tombol kirim tetap terkunci sampai kita pastikan lewat /api/run-aktif
      // bahwa memang tidak ada run yang kepencet dobel di server.
      try {
        const cek = await api.runAktif()
        if (cek.run) {
          setRunId(cek.run.runId)
          setProgres(cek.run)
          setLangkah(5)
        }
      } catch {
        /* biarkan staf coba lagi manual dari pesan error di atas */
      } finally {
        setBusyKirim(false)
      }
    }
  }

  function mulaiBaru() {
    setRunId(null)
    setProgres(null)
    setProgresError('')
    setPromo(null)
    setMaks(null)
    setHasil(null)
    setLangkah(1)
  }

  if (memeriksaRun) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-[#1a3a2a]" />
        <p className="text-sm text-slate-500">Memeriksa pengiriman sebelumnya…</p>
      </div>
    )
  }

  return (
    <div>
      {langkah !== 5 && <StepIndicator langkahAktif={langkah} />}

      {langkah === 1 && (
        <Step1Promo
          onPilih={(p) => {
            setPromo(p)
            setLangkah(2)
          }}
          onSesiHabis={onSesiHabis}
        />
      )}

      {langkah === 2 && promo && (
        <Step2Jumlah
          promo={promo}
          pengaturan={pengaturan}
          onHitung={(h, m) => {
            setHasil(h)
            setMaks(m)
            setLangkah(3)
          }}
          onBack={() => setLangkah(1)}
          onSesiHabis={onSesiHabis}
        />
      )}

      {langkah === 3 && promo && hasil && (
        <Step3Pratinjau
          promo={promo}
          hasil={hasil}
          maks={maks ?? 25}
          tarifPerPesan={pengaturan?.tarif_per_pesan ?? null}
          onLanjut={() => setLangkah(4)}
          onBack={() => setLangkah(2)}
        />
      )}

      {langkah === 4 && promo && hasil && maks !== null && (
        <Step4Kirim
          promo={promo}
          maks={maks}
          hasil={hasil}
          tarifPerPesan={pengaturan?.tarif_per_pesan ?? null}
          onKonfirmasi={kirimSekarang}
          onBack={() => setLangkah(3)}
          busy={busyKirim}
          error={kirimError}
        />
      )}

      {langkah === 5 && (
        <Step5Progres progres={progres} error={progresError} onMulaiBaru={mulaiBaru} />
      )}
    </div>
  )
}
