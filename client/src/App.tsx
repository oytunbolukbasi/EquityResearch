import { useState } from 'react'
import { BotMessageSquare } from 'lucide-react'

import { DashboardCanvas } from '@/features/dashboard/DashboardCanvas'
import { AdminPage } from '@/features/admin/AdminPage'
import { SelectedTickerCtx } from '@/features/dashboard/selected-ticker'
import { useDashboardLayout } from '@/features/dashboard/useDashboardLayout'
import { DashboardWidgetControls } from '@/features/dashboard/DashboardWidgetControls'

export default function App() {
  if (window.location.pathname === '/admin') return <AdminPage />

  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
  const { items, layout, addWidget, removeWidget, onLayoutChange, resetLayout } =
    useDashboardLayout()

  return (
    <SelectedTickerCtx.Provider value={{ selectedTicker, setSelectedTicker }}>
      <div className="min-h-screen">
        <header className="bg-card/70 sticky top-0 z-20 border-b backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-3 sm:px-8">
            <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <BotMessageSquare className="size-5 text-[#1a7a5e]" strokeWidth={1.75} />
              EQR
            </h1>
            <DashboardWidgetControls onAdd={addWidget} onReset={resetLayout} />
          </div>
        </header>

        <main className="px-5 py-6 sm:px-8">
          <DashboardCanvas
            items={items}
            layout={layout}
            onLayoutChange={onLayoutChange}
            addWidget={addWidget}
            removeWidget={removeWidget}
          />
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
    </SelectedTickerCtx.Provider>
  )
}
