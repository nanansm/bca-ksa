import { useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../lib/api'
import StepIndicator from './StepIndicator'
import Step1Promo from './Step1Promo'
import Step2Jumlah from './Step2Jumlah'
import Step3Pratinjau from './Step3Pratinjau'
import Step4Kirim from './Step4Kirim'
import Step5Progres from './Step5Progres'
import type { HitungResult, KirimResult, Maks, PromoView } from '../types'

const KUNCI_RUN = 'ksa-bc-run-id'

type Langkah = 1 | 2 | 3 | 4 | 5

export default function Wizard({ onSesiHabis }: { onSesiHabis: () => void }) {
  const [memeriksaRun, setMemeriksaRun] = useState(true)
  const [langkah, setLangkah] = useState<Langkah>(1)

  const [promo, setPromo] = useState<PromoView | null>(null)
  const [maks, setMaks] = useState<Maks | null>(null)
  const [hasil, setHasil] = useState<HitungResult | null>(null)

  const [runId, setRunId] = useState<string | null>(null)
  const [progres, setProgres] = useState<KirimResult | null>(null)
  const [progresError, setProgresError] = useState('')
  const [busyKirim, setBusyKirim] = useState(false)
  const [kirimError, setKirimError] = useState('')

  const timerRef = useRef<number | null>(null)

  // Sekali saat halaman dibuka: kalau ada pengiriman yang belum selesai, lompat ke layar progres.
  useEffect(() => {
    const disimpan = localStorage.getItem(KUNCI_RUN)
    if (!disimpan) {
      setMemeriksaRun(false)
      return
    }
    api
      .progress(disimpan)
      .then((r) => {
        if (r.status === 'jalan') {
          setRunId(disimpan)
          setProgres(r)
          setLangkah(5)
        } else {
          localStorage.removeItem(KUNCI_RUN)
        }
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          onSesiHabis()
          return
        }
        localStorage.removeItem(KUNCI_RUN)
      })
      .finally(() => setMemeriksaRun(false))
    // hanya jalan sekali saat mount
    // eslint-disable-next-line
  }, [])

  // Polling progres tiap 5 detik selama masih di layar 5 dan statusnya "jalan".
  useEffect(() => {
    if (langkah !== 5 || !runId) return
    if (progres && progres.status !== 'jalan') return

    timerRef.current = window.setInterval(() => {
      api
        .progress(runId)
        .then((r) => {
          setProgres(r)
          setProgresError('')
          if (r.status !== 'jalan') localStorage.removeItem(KUNCI_RUN)
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
      localStorage.setItem(KUNCI_RUN, res.runId)
      setRunId(res.runId)
      setProgres(res)
      setLangkah(5)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onSesiHabis()
        return
      }
      setKirimError(err instanceof Error ? err.message : 'Gagal memulai pengiriman.')
    } finally {
      setBusyKirim(false)
    }
  }

  function mulaiBaru() {
    localStorage.removeItem(KUNCI_RUN)
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
          onLanjut={() => setLangkah(4)}
          onBack={() => setLangkah(2)}
        />
      )}

      {langkah === 4 && promo && hasil && maks !== null && (
        <Step4Kirim
          promo={promo}
          maks={maks}
          hasil={hasil}
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
