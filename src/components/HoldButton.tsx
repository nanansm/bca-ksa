import { useEffect, useRef, useState } from 'react'

const DURASI_MS = 3000

/**
 * Tombol tahan 3 detik. Sengaja bukan tombol ketuk biasa — kirim promo makan
 * biaya per pesan, jadi harus ada jeda niat sebelum kepencet.
 * Jalan dengan sentuhan (pointer events) dan keyboard (spasi/enter ditahan).
 */
export default function HoldButton({
  label,
  onSelesai,
  disabled,
}: {
  label: string
  onSelesai: () => void
  disabled?: boolean
}) {
  const [persen, setPersen] = useState(0)
  const [menahan, setMenahan] = useState(false)
  const frameRef = useRef<number | null>(null)
  const mulaiRef = useRef(0)
  const selesaiRef = useRef(false)

  function berhenti() {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    setMenahan(false)
    setPersen(0)
  }

  function mulai() {
    if (disabled || frameRef.current !== null) return
    selesaiRef.current = false
    setMenahan(true)
    mulaiRef.current = performance.now()

    const langkah = (sekarang: number) => {
      const berlalu = sekarang - mulaiRef.current
      const p = Math.min(100, (berlalu / DURASI_MS) * 100)
      setPersen(p)
      if (p >= 100) {
        frameRef.current = null
        selesaiRef.current = true
        setMenahan(false)
        onSelesai()
        return
      }
      frameRef.current = requestAnimationFrame(langkah)
    }
    frameRef.current = requestAnimationFrame(langkah)
  }

  function lepas() {
    if (!selesaiRef.current) berhenti()
  }

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    },
    [],
  )

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={mulai}
      onPointerUp={lepas}
      onPointerCancel={lepas}
      onPointerLeave={lepas}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) mulai()
      }}
      onKeyUp={(e) => {
        if (e.key === ' ' || e.key === 'Enter') lepas()
      }}
      className="btn-primary relative touch-none select-none overflow-hidden"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 bg-[#1a3a2a]/20"
        style={{ width: `${persen}%`, transition: menahan ? 'none' : 'width 150ms ease-out' }}
      />
      <span className="relative">{menahan ? 'Tahan terus…' : label}</span>
    </button>
  )
}
