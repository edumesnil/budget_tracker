"use client"

import type React from "react"

import { createContext, useContext } from "react"

export type BudgetContextType = {
  activeView: "monthly" | "annual"
  setActiveView: (view: "monthly" | "annual") => void
  selectedMonth: number
  setSelectedMonth: (month: number) => void
  selectedYear: number
  setSelectedYear: (year: number) => void
  categories: any[]
  baseBudgets: any[]
  setBaseBudgets: (budgets: any[]) => void
  customBudgets: any[]
  setCustomBudgets: (budgets: any[]) => void
  transactions: any[]
  goToPreviousMonth: () => void
  goToNextMonth: () => void
  refreshData: () => void
}

const BudgetContext = createContext<BudgetContextType | undefined>(undefined)

export function BudgetProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: BudgetContextType
}) {
  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>
}

export function useBudgetContext() {
  const context = useContext(BudgetContext)
  if (context === undefined) {
    throw new Error("useBudgetContext must be used within a BudgetProvider")
  }
  return context
}

