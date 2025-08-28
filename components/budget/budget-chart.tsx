"use client"

import { useState } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, LabelList } from "recharts"

type BudgetChartProps = {
  budgetData: any[]
  month: number
  year: number
}

export function BudgetChart({ budgetData, month, year }: BudgetChartProps) {
  const [chartType, setChartType] = useState<"overview" | "category">("overview")

  // Calculate totals for overview chart
  const totalBudgetIncome = budgetData
    .filter((item) => item.category_type === "INCOME")
    .reduce((sum, item) => sum + Math.abs(item.amount), 0)

  const totalActualIncome = budgetData
    .filter((item) => item.category_type === "INCOME")
    .reduce((sum, item) => sum + Math.abs(item.actual), 0)

  const totalBudgetExpense = budgetData
    .filter((item) => item.category_type === "EXPENSE")
    .reduce((sum, item) => sum + Math.abs(item.amount), 0)

  const totalActualExpense = budgetData
    .filter((item) => item.category_type === "EXPENSE")
    .reduce((sum, item) => sum + Math.abs(item.actual), 0)

  // Prepare data for overview chart
  const overviewData = [
    {
      name: "Income (Budget)",
      value: totalBudgetIncome,
      category: "INCOME",
      type: "Budget",
      color: "hsl(var(--income) / 0.3)",
      hoverColor: "hsl(var(--income) / 0.35)",
    },
    {
      name: "Income (Actual)",
      value: totalActualIncome,
      category: "INCOME",
      type: "Actual",
      color: "hsl(var(--income))",
      hoverColor: "hsl(var(--income) / 0.95)",
    },
    {
      name: "Expenses (Budget)",
      value: totalBudgetExpense,
      category: "EXPENSE",
      type: "Budget",
      color: "hsl(var(--expense) / 0.3)",
      hoverColor: "hsl(var(--expense) / 0.35)",
    },
    {
      name: "Expenses (Actual)",
      value: totalActualExpense,
      category: "EXPENSE",
      type: "Actual",
      color: "hsl(var(--expense))",
      hoverColor: "hsl(var(--expense) / 0.95)",
    },
  ]

  // Prepare data for category chart - top categories by budget amount
  const categoryData = budgetData
    .filter((item) => item.amount > 0 || item.actual > 0)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 6)
    .map((item) => ({
      name: item.category_name,
      budget: Math.abs(item.amount),
      actual: Math.abs(item.actual),
      type: item.category_type,
    }))

  // Custom tooltip formatter that removes the "value" label
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null

    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="mb-1 text-sm font-medium">{payload[0].name}</div>
        <div className="text-sm font-semibold">${payload[0].value.toFixed(2)}</div>
      </div>
    )
  }

  // Custom label formatter
  const renderCustomizedLabel = (props: any) => {
    const { x, y, width, height, value } = props

    return (
      <g>
        <text
          x={x + width + 10}
          y={y + height / 2}
          fill="#666"
          textAnchor="start"
          dominantBaseline="middle"
          className="text-sm font-medium"
        >
          ${value.toFixed(0)}
        </text>
      </g>
    )
  }

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

  return (
    <div className="w-full h-full flex flex-col">
      <div className="mb-4">
        <Tabs value={chartType} onValueChange={(value) => setChartType(value as any)}>
          <TabsList className="bg-secondary/70">
            <TabsTrigger
              value="overview"
              className={
                chartType === "overview"
                  ? "bg-primary text-primary-foreground"
                  : "data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
              }
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="category"
              className={
                chartType === "category"
                  ? "bg-primary text-primary-foreground"
                  : "data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
              }
            >
              By Category
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1" style={{ minHeight: "250px" }}>
        {chartType === "overview" ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={overviewData}
              layout="vertical"
              margin={{ top: 10, right: 80, left: 100, bottom: 10 }}
              barSize={30}
              className="[&_.recharts-cartesian-axis-tick-value]:translate-x-[-8px]"
            >
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                axisLine={false}
                tickLine={false}
                fontSize={14}
                tick={{ transform: "translate(-8, 0)" }}
              />
              <XAxis type="number" hide={true} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0, 0, 0, 0.02)" }} />
              <Bar dataKey="value" radius={[4, 4, 4, 4]} minPointSize={2} animationDuration={300}>
                {overviewData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    className="transition-colors duration-150"
                    style={{
                      cursor: "pointer",
                      // Very subtle hover effect using CSS variables
                      "--normal-fill": entry.color,
                      "--hover-fill": entry.hoverColor,
                    }}
                    onMouseOver={(e: any) => {
                      e.target.style.fill = "var(--hover-fill)"
                    }}
                    onMouseOut={(e: any) => {
                      e.target.style.fill = "var(--normal-fill)"
                    }}
                  />
                ))}
                <LabelList dataKey="value" position="right" content={renderCustomizedLabel} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryData} margin={{ top: 20, right: 30, left: 20, bottom: 10 }} barSize={20} barGap={8}>
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
                height={40}
                interval={0}
                tickMargin={8}
              />
              <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0, 0, 0, 0.02)" }} />
              <Bar name="Budget" dataKey="budget" radius={[4, 4, 0, 0]} animationDuration={300}>
                {categoryData.map((entry, index) => {
                  const color = entry.type === "INCOME" ? "hsl(var(--income) / 0.3)" : "hsl(var(--expense) / 0.3)"
                  const hoverColor =
                    entry.type === "INCOME" ? "hsl(var(--income) / 0.35)" : "hsl(var(--expense) / 0.35)"

                  return (
                    <Cell
                      key={`cell-budget-${index}`}
                      fill={color}
                      className="transition-colors duration-150"
                      style={{
                        cursor: "pointer",
                        "--normal-fill": color,
                        "--hover-fill": hoverColor,
                      }}
                      onMouseOver={(e: any) => {
                        e.target.style.fill = "var(--hover-fill)"
                      }}
                      onMouseOut={(e: any) => {
                        e.target.style.fill = "var(--normal-fill)"
                      }}
                    />
                  )
                })}
              </Bar>
              <Bar name="Actual" dataKey="actual" radius={[4, 4, 0, 0]} animationDuration={300}>
                {categoryData.map((entry, index) => {
                  const color = entry.type === "INCOME" ? "hsl(var(--income))" : "hsl(var(--expense))"
                  const hoverColor =
                    entry.type === "INCOME" ? "hsl(var(--income) / 0.95)" : "hsl(var(--expense) / 0.95)"

                  return (
                    <Cell
                      key={`cell-actual-${index}\`  / 0.95)"

                  return (
                    <Cell
                      key={\`cell-actual-${index}`}
                      fill={color}
                      className="transition-colors duration-150"
                      style={{
                        cursor: "pointer",
                        "--normal-fill": color,
                        "--hover-fill": hoverColor,
                      }}
                      onMouseOver={(e: any) => {
                        e.target.style.fill = "var(--hover-fill)"
                      }}
                      onMouseOut={(e: any) => {
                        e.target.style.fill = "var(--normal-fill)"
                      }}
                    />
                  )
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

