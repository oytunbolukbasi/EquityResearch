import { PaperTradingWidget } from '@/features/widgets/PaperTradingWidget'
import { Chip, TabHeading } from './Panel'

/**
 * Single panel, no split. The widget is reused verbatim — it offsets its tables
 * with `-m-4` against a `p-4` parent, which is why the card keeps that padding.
 */
export function PaperTab() {
  return (
    <div>
      <TabHeading
        title="Paper Trading"
        subtitle="Alpaca kâğıt hesabı · Sadece NYSE/NASDAQ, BİST hariç."
        right={<Chip>Otomatik: fikir → limit emir</Chip>}
      />
      <section className="eqr-panel bg-card border-faint rounded-xl border p-4">
        <PaperTradingWidget />
      </section>
    </div>
  )
}
