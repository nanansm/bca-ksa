import type { ReactNode } from 'react'

/** Halaman yang punya menu navigasi. Tambah key baru di sini DAN di array MENU di bawah. */
export type Halaman = 'dashboard' | 'kirim-promo' | 'buat-promo' | 'daftar-tamu'

function IkonDashboard({ aktif }: { aktif: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={'h-5 w-5 ' + (aktif ? 'text-[#1a3a2a]' : 'text-slate-400')}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
    </svg>
  )
}

function IkonKirim({ aktif }: { aktif: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={'h-5 w-5 ' + (aktif ? 'text-[#1a3a2a]' : 'text-slate-400')}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 3 3 10.5l7.5 3L13.5 21 21 3Z" />
      <path d="M10.5 13.5 21 3" />
    </svg>
  )
}

function IkonBuatPromo({ aktif }: { aktif: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={'h-5 w-5 ' + (aktif ? 'text-[#1a3a2a]' : 'text-slate-400')}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function IkonDaftarTamu({ aktif }: { aktif: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={'h-5 w-5 ' + (aktif ? 'text-[#1a3a2a]' : 'text-slate-400')}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="7" r="3.5" />
      <path d="M3.5 20c0-3.6 2.5-6 5.5-6s5.5 2.4 5.5 6" />
      <path d="M16 8h5M16 12h5" />
    </svg>
  )
}

const MENU: { key: Halaman; label: string; ikon: (p: { aktif: boolean }) => ReactNode }[] = [
  { key: 'dashboard', label: 'Dashboard', ikon: IkonDashboard },
  { key: 'kirim-promo', label: 'Kirim Promo', ikon: IkonKirim },
  { key: 'buat-promo', label: 'Buat Promo', ikon: IkonBuatPromo },
  { key: 'daftar-tamu', label: 'Daftar Tamu', ikon: IkonDaftarTamu },
]

export default function Cangkang({
  halaman,
  onNavigate,
  onLogout,
  children,
}: {
  halaman: Halaman
  onNavigate: (h: Halaman) => void
  onLogout: () => void
  children: ReactNode
}) {
  return (
    <div className="min-h-dvh">
      {/* Bar atas — sama di semua lebar layar, jadi tombol Keluar selalu
          terjangkau walau sidebar/tab bawah belum ke-render. */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
        <div>
          <p className="text-sm font-bold leading-tight">Broadcast WhatsApp</p>
          <p className="text-xs text-slate-500">Kampung Sumber Alam</p>
        </div>
        <button
          onClick={onLogout}
          className="-mr-2 min-h-[44px] min-w-[44px] rounded-lg px-3 text-sm font-medium text-slate-500"
        >
          Keluar
        </button>
      </header>

      <div className="mx-auto flex max-w-6xl items-start">
        {/* Sidebar — cuma tampil >= 768px (md), menempel kiri, tetap kelihatan
            saat konten discroll (sticky). */}
        <aside className="sticky top-[57px] hidden h-[calc(100dvh-57px)] w-56 shrink-0 flex-col border-r border-slate-200 py-4 md:flex">
          <nav className="flex flex-col gap-1 px-3">
            {MENU.map((item) => {
              const aktif = item.key === halaman
              return (
                <button
                  key={item.key}
                  onClick={() => onNavigate(item.key)}
                  className={
                    'flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium transition ' +
                    (aktif
                      ? 'bg-brand-400/25 font-semibold text-[#1a3a2a]'
                      : 'text-slate-600 hover:bg-slate-50')
                  }
                >
                  <item.ikon aktif={aktif} />
                  {item.label}
                </button>
              )
            })}
          </nav>
        </aside>

        {/* pb-24 kasih ruang biar konten paling bawah tidak ketutup tab bar
            di layar sempit — di md+ tab bar tidak ada jadi cukup pb-6. */}
        <main className="min-w-0 flex-1 px-4 py-6 pb-24 md:px-6 md:pb-6">{children}</main>
      </div>

      {/* Tab bawah — cuma tampil < 768px. Ditaruh di bawah karena jempol
          lebih gampang menjangkau situ daripada hamburger di atas, dan
          menunya cuma dua jadi muat tanpa perlu "more". */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-200 bg-white md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {MENU.map((item) => {
          const aktif = item.key === halaman
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={
                'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ' +
                (aktif ? 'text-[#1a3a2a]' : 'text-slate-400')
              }
            >
              <item.ikon aktif={aktif} />
              {item.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
