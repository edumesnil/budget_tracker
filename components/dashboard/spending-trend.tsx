"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface SpendingTrendProps {
  spendingTrend: any[]
}

export function SpendingTrend({ spendingTrend }: SpendingTrendProps) {
  return (
    <Card className="overflow-hidden border-border/60 hover:border-primary/30 transition-colors duration-200">
      <CardHeader className="pb-2">
        <CardTitle>Spending Trends</CardTitle>
        <CardDescription>Your expense patterns over the last 3 months</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ChartContainer
            config={{
              amount: {
                label: "Amount",
                color: "hsl(var(--chart-1))",
              },
            }}
            className="h-[300px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spendingTrend} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `$${value}`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="var(--color-amount)"
                  strokeWidth={2}
                  activeDot={{ r: 6 }}
                  animationDuration={500}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  )
}

