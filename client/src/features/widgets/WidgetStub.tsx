import type { LucideIcon } from 'lucide-react'

/** Placeholder body for v1 widgets. Real content lands in Step 4. */
export function WidgetStub({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="text-mid flex h-full flex-col items-center justify-center gap-2 text-center">
      <Icon className="size-7 opacity-40" strokeWidth={1.5} />
      <p className="max-w-[26ch] text-sm leading-relaxed">{children}</p>
      <span className="num text-[11px] tracking-[0.12em] uppercase opacity-50">Adım 4</span>
    </div>
  )
}
