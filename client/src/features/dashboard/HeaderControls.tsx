import { useState } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })

function fmtLabel(date: string | null): string {
  if (!date) return dateFmt.format(new Date())
  return dateFmt.format(new Date(date + 'T12:00:00'))
}

export function DateMenuButton({
  date, onSelect, onClear,
}: {
  date: string | null
  onSelect: (d: string) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="num gap-1.5">
          <Calendar className="size-4" />
          {fmtLabel(date)}
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-3">
        <label className="text-mid mb-2 block text-[11px] tracking-wide uppercase">
          Tarihe göre görüntüle
        </label>
        <input
          type="date"
          value={date ?? ''}
          onChange={e => e.target.value && onSelect(e.target.value)}
          className="num w-full rounded border border-faint bg-card px-2 py-1.5 text-sm focus:border-info focus:outline-none"
        />
        {date && (
          <button
            onClick={() => {
              onClear()
              setOpen(false)
            }}
            className="text-info mt-2 text-sm font-medium hover:underline"
          >
            Tümünü Gör
          </button>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
