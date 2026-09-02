import { useEffect, useState } from 'react'
import Login from './components/Login'
import { api } from './lib/api'

export default function App() {
  const [state, setState] = useState<'loading' | 'out' | 'in'>('loading')

  useEffect(() => {
    api
      .me()
      .then((r) => setState(r.loggedIn ? 'in' : 'out'))
      .catch(() => setState('out'))
  }, [])

  if (state === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#1a3a2a]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-brand-400" />
      </div>
    )
  }

  if (state === 'out') return <Login onSuccess={() => setState('in')} />

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-bold leading-tight">Broadcast WhatsApp</p>
            <p className="text-xs text-slate-500">Kampung Sumber Alam</p>
          </div>
          <button
            onClick={() => api.logout().then(() => setState('out'))}
            className="text-sm font-medium text-slate-500"
          >
            Keluar
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="card p-5">
          <p className="text-sm text-slate-600">Sedang disiapkan.</p>
        </div>
      </main>
    </div>
  )
}
