export type StatusTab = 'active' | 'history'

export function StatusTabs({
  tab, onChange,
}: {
  tab: StatusTab
  onChange: (t: StatusTab) => void
}) {
  return (
    <div className="mb-3 flex gap-3 border-b border-faint">
      {(['active', 'history'] as const).map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={[
            'num -mb-px border-b-2 px-1 pb-2 text-xs font-medium transition-colors',
            tab === t
              ? 'border-info text-info'
              : 'border-transparent text-mid hover:text-ink',
          ].join(' ')}
        >
          {t === 'active' ? 'Aktif' : 'Geçmiş'}
        </button>
      ))}
    </div>
  )
}
