import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// Step 1 scaffold check: renders the design tokens (palette, fonts, card
// hierarchy) so we can confirm the system before building the canvas/widgets.
const palette = [
  { name: 'green', label: 'Yükseliş', cls: 'bg-up' },
  { name: 'red', label: 'Düşüş', cls: 'bg-down' },
  { name: 'blue', label: 'Bilgi', cls: 'bg-info' },
  { name: 'amber', label: 'Uyarı', cls: 'bg-warn' },
  { name: 'ink', label: 'Metin', cls: 'bg-ink' },
  { name: 'faint', label: 'Kenarlık', cls: 'bg-faint' },
]

export default function App() {
  return (
    <div className="min-h-screen px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <div className="num text-mid text-[11px] tracking-[0.14em] uppercase">
            Yatırım Dashboard · v1
          </div>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight">
            Tasarım Sistemi <span className="text-mid font-light">· iskelet kontrolü</span>
          </h1>
          <p className="num text-mid mt-1 text-sm">
            Open Sans + JetBrains Mono · ç ğ ı ş ü ö · 20 Haziran 2026
          </p>
        </header>

        <div className="grid gap-5 sm:grid-cols-2">
          <Card className="p-6">
            <div className="num text-mid text-[11px] tracking-[0.14em] uppercase">
              Kart Hiyerarşisi
            </div>
            <h2 className="text-xl font-medium tracking-tight">Beyaz kart · radius 14px</h2>
            <p className="text-mid text-sm leading-relaxed">
              Başlık ve metin <b className="text-ink font-medium">Open Sans</b> ile. Sayısal
              değerler her zaman mono ile yazılır.
            </p>
            <div className="border-faint mt-2 flex items-center justify-between border-t pt-4">
              <span className="text-mid text-sm">Mevcut Fiyat</span>
              <span className="num text-ink font-medium">
                $492,99{' '}
                <span className="bg-up/10 text-up ml-1 rounded px-2 py-0.5 text-xs">+%1,8</span>
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm">Birincil</Button>
              <Button size="sm" variant="outline">
                İkincil
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <div className="num text-mid text-[11px] tracking-[0.14em] uppercase">Renk Paleti</div>
            <div className="mt-1 grid grid-cols-2 gap-3">
              {palette.map((c) => (
                <div key={c.name} className="flex items-center gap-2.5">
                  <span className={`${c.cls} border-faint size-6 rounded-md border`} />
                  <span className="text-sm">
                    {c.label} <span className="num text-mid text-xs">· {c.name}</span>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <p className="text-mid mt-6 text-xs">
          Adım 1 — proje iskeleti ve tasarım token'ları. Sonraki adım: react-grid-layout canvas.
        </p>
      </div>
    </div>
  )
}
