import type {
  HitungResult,
  Maks,
  Progres,
  PromoApi,
  ResponKirim,
  ResponPengaturan,
} from '../types'

export class ApiError extends Error {
  status: number
  /** Isi balasan JSON server, kalau ada. Dipakai mis. buat baca `run` di balasan 409. */
  data?: unknown
  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.status = status
    this.data = data
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  })

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    /* biarkan null — ditangani di bawah */
  }

  if (!response.ok) {
    const message =
      (payload as { error?: string } | null)?.error || 'Gagal menghubungi server. Coba lagi.'
    throw new ApiError(message, response.status, payload)
  }
  return payload as T
}

export const api = {
  me: () => request<{ loggedIn: boolean }>('/api/me'),
  login: (user: string, pass: string) =>
    request<{ ok: true }>('/api/login', { method: 'POST', body: JSON.stringify({ user, pass }) }),
  logout: () => request<{ ok: true }>('/api/logout', { method: 'POST' }),
  promos: () => request<{ ok: true; promos: PromoApi[] }>('/api/promos'),
  pengaturan: () => request<ResponPengaturan>('/api/pengaturan'),
  hitung: (template: string, label: string, maks: Maks) =>
    request<HitungResult>('/api/hitung', {
      method: 'POST',
      body: JSON.stringify({ template, label, maks }),
    }),
  /**
   * Kalau server balas 409 (sudah ada run jalan), error yang dilempar membawa
   * `data.run` (bentuk `Progres`) — pemanggil boleh langsung lompat ke layar
   * progres pakai itu tanpa nge-hit /api/run-aktif lagi.
   */
  kirim: (template: string, label: string, maks: Maks) =>
    request<ResponKirim>('/api/kirim', {
      method: 'POST',
      body: JSON.stringify({ template, label, maks, konfirmasi: true }),
    }),
  progress: (runId: string) => request<Progres>(`/api/progress?run=${encodeURIComponent(runId)}`),
  runAktif: () => request<{ ok: true; run: Progres | null }>('/api/run-aktif'),
}
