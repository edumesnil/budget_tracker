"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import type { MonthlyBudgetSummary } from "@/hooks/use-budget"
import {
  CustomTable,
  CustomTableHeader,
  CustomTableBody,
  CustomTableRow,
  CustomTableCell,
  CustomTableHeaderCell,
} from "@/components/ui/custom-table"

type AnnualSummaryTableProps = {
  annualData: MonthlyBudgetSummary[]
  onSelectMonth: (month: number) => void
}

export function AnnualSummaryTable({ annualData, onSelectMonth }: AnnualSummaryTableProps) {
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]

  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Annual Budget Overview - {annualData[0]?.year || new Date().getFullYear()}</CardTitle>
        <CardDescription>Track your budget and spending across all months</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <CustomTable>
            <CustomTableHeader className="grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr]">
              <CustomTableHeaderCell>Month</CustomTableHeaderCell>
              <CustomTableHeaderCell align="right">Budgeted Income</CustomTableHeaderCell>
              <CustomTableHeaderCell align="right">Actual Income</CustomTableHeaderCell>
              <CustomTableHeaderCell align="right">Budgeted Expenses</CustomTableHeaderCell>
              <CustomTableHeaderCell align="right">Actual Expenses</CustomTableHeaderCell>
              <CustomTableHeaderCell align="right">Net Budget</CustomTableHeaderCell>
              <CustomTableHeaderCell align="right">Net Actual</CustomTableHeaderCell>
              <CustomTableHeaderCell align="right">Status</CustomTableHeaderCell>
            </CustomTableHeader>
            <CustomTableBody>
              {annualData.map((month) => {
                const isOverBudget = month.netActual < month.netBudget
                const year = month.year
                const isPastMonth = year < currentYear || (year === currentYear && month.month < currentMonth)
                const isCurrentMonth = year === currentYear && month.month === currentMonth

                return (
                  <CustomTableRow
                    key={month.month}
                    className={`grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] cursor-pointer ${isCurrentMonth ? "bg-blue-50/50 dark:bg-blue-900/10" : ""}`}
                    onClick={() => onSelectMonth(month.month)}
                  >
                    <CustomTableCell>{monthNames[month.month - 1]}</CustomTableCell>
                    <CustomTableCell align="right">${Math.round(month.totalIncome)}</CustomTableCell>
                    <CustomTableCell align="right">
                      <span className={month.actualIncome >= month.totalIncome ? "text-green-500" : "text-red-500"}>
                        ${Math.round(month.actualIncome)}
                      </span>
                    </CustomTableCell>
                    <CustomTableCell align="right">${Math.round(month.totalExpenses)}</CustomTableCell>
                    <CustomTableCell align="right">
                      <span className={month.actualExpenses <= month.totalExpenses ? "text-green-500" : "text-red-500"}>
                        ${Math.round(month.actualExpenses)}
                      </span>
                    </CustomTableCell>
                    <CustomTableCell align="right">${Math.round(month.netBudget)}</CustomTableCell>
                    <CustomTableCell align="right">${Math.round(month.netActual)}</CustomTableCell>
                    <CustomTableCell align="right">
                      {isPastMonth ? (
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            isOverBudget
                              ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                              : "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                          }`}
                        >
                          {isOverBudget ? (
                            <>
                              <ArrowDownRight className="h-3 w-3 mr-1" />
                              Over Budget
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="h-3 w-3 mr-1" />
                              Under Budget
                            </>
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                          Planned
                        </span>
                      )}
                    </CustomTableCell>
                  </CustomTableRow>
                )
              })}
            </CustomTableBody>
          </CustomTable>
        </div>
      </CardContent>
    </Card>
  )
}

