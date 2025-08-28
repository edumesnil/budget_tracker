"use client"

import { createContext, useContext } from "react"

export interface ChartConfig {
  [key: string]: {
    label: string
    color: string
  }
}

export const ChartContext = createContext<ChartConfig | null>(null)

export function useChartConfig() {
  const context = useContext(ChartContext)
  if (!context) {
    throw new Error("useChartConfig must be used within a ChartProvider")
  }
  return context
}

