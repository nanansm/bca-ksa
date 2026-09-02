import type { HitungResult, KirimResult, Maks, PromoApi } from '../types'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
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
    throw new ApiError(message, response.status)
  }
  return payload as T
}

export const api = {
  me: () => request<{ loggedIn: boolean }>('/api/me'),
  login: (user: string, pass: string) =>
    request<{ ok: true }>('/api/login', { method: 'POST', body: JSON.stringify({ user, pass }) }),
  logout: () => request<{ ok: true }>('/api/logout', { method: 'POST' }),
  promos: () => request<{ ok: true; promos: PromoApi[] }>('/api/promos'),
  hitung: (template: string, label: string, maks: Maks) =>
    request<HitungResult>('/api/hitung', {
      method: 'POST',
      body: JSON.stringify({ template, label, maks }),
    }),
  kirim: (template: string, label: string, maks: Maks) =>
    request<KirimResult>('/api/kirim', {
      method: 'POST',
      body: JSON.stringify({ template, label, maks, konfirmasi: true }),
    }),
  progress: (runId: string) =>
    request<KirimResult>(`/api/progress?run=${encodeURIComponent(runId)}`),
}
