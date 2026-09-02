const LANGKAH = [1, 2, 3] as const

export default function StepIndicator({ langkahAktif }: { langkahAktif: 1 | 2 | 3 }) {
  return (
    <ol className="mb-5 flex items-center gap-2">
      {LANGKAH.map((n, i) => {
        const lewat = n < langkahAktif
        const aktif = n === langkahAktif
        return (
          <li key={n} className="flex flex-1 items-center gap-2">
            <span
              className={
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ' +
                (lewat
                  ? 'bg-[#1a3a2a] text-white'
                  : aktif
                    ? 'bg-brand-400 text-slate-900'
                    : 'bg-slate-100 text-slate-400')
              }
            >
              {lewat ? (
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-white">
                  <path d="M8 13.4 4.6 10l-1.4 1.4L8 16.2 17 7.2 15.6 5.8z" />
                </svg>
              ) : (
                n
              )}
            </span>
            {i < LANGKAH.length - 1 && (
              <span className={'h-0.5 flex-1 ' + (lewat ? 'bg-[#1a3a2a]' : 'bg-slate-100')} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
