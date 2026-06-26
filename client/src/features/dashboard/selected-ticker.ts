import { createContext, useContext } from 'react'

interface SelectedTickerValue {
  selectedTicker: string | null
  setSelectedTicker: (t: string | null) => void
}

export const SelectedTickerCtx = createContext<SelectedTickerValue>({
  selectedTicker: null,
  setSelectedTicker: () => {},
})

export function useSelectedTicker(): SelectedTickerValue {
  return useContext(SelectedTickerCtx)
}
