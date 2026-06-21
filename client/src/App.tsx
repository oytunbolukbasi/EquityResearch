import { useState } from 'react'

import { DashboardCanvas } from '@/features/dashboard/DashboardCanvas'
import { AdminPage } from '@/features/admin/AdminPage'
import { DateFilterCtx } from '@/features/dashboard/date-filter'

const dateFmt = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export default function App() {
  if (window.location.pathname === '/admin') return <AdminPage />

  const [date, setDate] = useState<string | null>(null)
  const today = dateFmt.format(new Date())

  return (
    <DateFilterCtx.Provider value={{ date, setDate }}>
      <div className="min-h-screen">
        <header className="bg-card/70 sticky top-0 z-20 border-b backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-3 sm:px-8">
            <h1 className="text-lg font-semibold tracking-tight">EQR Dashboard</h1>
            <div className="flex items-center gap-2.5">
              <input
                type="date"
                value={date ?? ''}
                onChange={e => setDate(e.target.value || null)}
                className="num text-ink rounded border border-faint bg-card px-2 py-1 text-sm focus:border-info focus:outline-none"
                aria-label="Tarihe göre görüntüle"
              />
              {date ? (
                <button
                  onClick={() => setDate(null)}
                  className="text-info text-sm font-medium hover:underline"
                >
                  Tümünü Gör
                </button>
              ) : (
                <div className="num text-mid text-sm">{today}</div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] px-5 py-6 sm:px-8">
          <DashboardCanvas />
        </main>

        <footer className="border-t border-faint">
          <div className="mx-auto max-w-[1400px] px-5 py-3 sm:px-8">
            <p className="num text-[10px] text-mid">
              Charts powered by{' '}
              <a
                href="https://tradingview.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:underline"
              >
                TradingView
              </a>
              {' '}Lightweight Charts (Apache 2.0)
            </p>
          </div>
        </footer>
      </div>
    </DateFilterCtx.Provider>
  )
}
