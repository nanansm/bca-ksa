import { useEffect, useState } from 'react'
import Cangkang, { type Halaman } from './components/Cangkang'
import Login from './components/Login'
import Dashboard from './pages/Dashboard'
import KirimPromo from './pages/KirimPromo'
import BuatPromo from './pages/BuatPromo'
import { api } from './lib/api'

export default function App() {
  const [state, setState] = useState<'loading' | 'out' | 'in'>('loading')
  // Halaman awal = Dashboard, sesuai permintaan. Perpindahan halaman cukup
  // state React biasa — tidak perlu react-router buat dua halaman.
  const [halaman, setHalaman] = useState<Halaman>('dashboard')

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

  const keluar = () => api.logout().then(() => setState('out'))
  const sesiHabis = () => setState('out')

  return (
    <Cangkang halaman={halaman} onNavigate={setHalaman} onLogout={keluar}>
      {halaman === 'dashboard' && <Dashboard onSesiHabis={sesiHabis} />}
      {halaman === 'kirim-promo' && <KirimPromo onSesiHabis={sesiHabis} />}
      {halaman === 'buat-promo' && <BuatPromo onSesiHabis={sesiHabis} />}
    </Cangkang>
  )
}
