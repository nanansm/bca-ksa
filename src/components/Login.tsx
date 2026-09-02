import { useState, type FormEvent } from 'react'
import { api } from '../lib/api'

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.login(user.trim(), pass)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk.')
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-[#1a3a2a] px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-400 text-2xl">
            💬
          </div>
          <h1 className="text-xl font-bold text-white">Broadcast WhatsApp</h1>
          <p className="mt-1 text-sm text-white/60">Kampung Sumber Alam</p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-5">
          <div>
            <label htmlFor="user" className="mb-1.5 block text-sm font-medium text-slate-700">
              Username
            </label>
            <input
              id="user"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-brand-400 focus:bg-white"
              placeholder="ksa"
            />
          </div>

          <div>
            <label htmlFor="pass" className="mb-1.5 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="pass"
              type="password"
              autoComplete="current-password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-brand-400 focus:bg-white"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          )}

          <button type="submit" disabled={busy || !user || !pass} className="btn-primary">
            {busy ? 'Memeriksa…' : 'Masuk'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-white/40">
          Halaman internal Kampung Sumber Alam
        </p>
      </div>
    </div>
  )
}
