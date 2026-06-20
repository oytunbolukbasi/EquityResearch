import { DashboardCanvas } from '@/features/dashboard/DashboardCanvas'

const dateFmt = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export default function App() {
  const today = dateFmt.format(new Date())

  return (
    <div className="min-h-screen">
      <header className="bg-card/70 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-3 sm:px-8">
          <div>
            <div className="num text-mid text-[11px] tracking-[0.14em] uppercase">
              Yatırım Dashboard
            </div>
            <h1 className="text-lg font-semibold tracking-tight">
              Panel <span className="text-mid font-light">· v1</span>
            </h1>
          </div>
          <div className="num text-mid text-sm">{today}</div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-5 py-6 sm:px-8">
        <DashboardCanvas />
      </main>
    </div>
  )
}
