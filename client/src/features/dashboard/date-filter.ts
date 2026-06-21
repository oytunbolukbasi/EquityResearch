import { createContext, useContext } from 'react'

interface DateFilterValue {
  date: string | null
  setDate: (d: string | null) => void
}

export const DateFilterCtx = createContext<DateFilterValue>({
  date: null,
  setDate: () => {},
})

export function useDateFilter(): DateFilterValue {
  return useContext(DateFilterCtx)
}

/** Appends `?date=` (or `&date=` if the base url already has a query string) when a date is selected. */
export function withDate(url: string, date: string | null): string {
  if (!date) return url
  return url.includes('?') ? `${url}&date=${date}` : `${url}?date=${date}`
}
