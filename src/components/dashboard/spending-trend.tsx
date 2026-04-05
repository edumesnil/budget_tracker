import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { css } from "../../../styled-system/css";
import { formatCurrency } from "@/lib/utils";
import type { Transaction } from "@/types/database";
import * as Card from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MonthData {
  label: string;
  income: number;
  expenses: number;
}

interface Props {
  /** Transactions from the last 6 months, pre-fetched by parent */
  transactions: Transaction[];
  /** The currently-viewed month (1-12) */
  currentMonth: number;
  /** The currently-viewed year */
  currentYear: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function getPrior6Months(
  month: number,
  year: number,
): Array<{ month: number; year: number; label: string }> {
  const result = [];
  for (let i = 5; i >= 0; i--) {
    let m = month - i;
    let y = year;
    if (m <= 0) {
      m += 12;
      y -= 1;
    }
    result.push({ month: m, year: y, label: MONTH_ABBR[m - 1] });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <Card.Root>
      <Card.Body className={css({ px: "3", py: "2", fontSize: "xs" })}>
        <p className={css({ fontWeight: "600", color: "fg.default", mb: "1" })}>{label}</p>
        {payload.map((p) => (
          <p key={p.name} className={css({ color: "fg.muted" })} style={{ color: p.color }}>
            {p.name}: {formatCurrency(p.value)}
          </p>
        ))}
      </Card.Body>
    </Card.Root>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SpendingTrend({ transactions, currentMonth, currentYear }: Props) {
  const periods = useMemo(
    () => getPrior6Months(currentMonth, currentYear),
    [currentMonth, currentYear],
  );

  const chartData = useMemo<MonthData[]>(() => {
    return periods.map(({ month, year, label }) => {
      let income = 0;
      let expenses = 0;

      for (const tx of transactions) {
        const d = new Date(tx.date);
        if (d.getMonth() + 1 !== month || d.getFullYear() !== year) continue;
        const type = tx.categories?.type;
        if (type === "INCOME") income += Number(tx.amount);
        else if (type === "EXPENSE") expenses += Number(tx.amount);
      }

      return { label, income, expenses };
    });
  }, [transactions, periods]);

  // Count months that have any data
  const monthsWithData = chartData.filter((d) => d.income > 0 || d.expenses > 0).length;

  if (monthsWithData < 2) {
    return (
      <div
        className={css({
          display: "flex",
          flexDir: "column",
          alignItems: "center",
          justifyContent: "center",
          h: "40",
          color: "fg.muted",
          fontSize: "sm",
          textAlign: "center",
          gap: "1",
        })}
      >
        <p className={css({ fontWeight: "500" })}>Not enough data</p>
        <p className={css({ fontSize: "xs" })}>Trend shows after 2+ months of transactions.</p>
      </div>
    );
  }

  // Accessible summary: last month vs current
  const last = chartData[chartData.length - 2];
  const curr = chartData[chartData.length - 1];
  const summaryText = `Spending trend over 6 months. Most recent month: income ${formatCurrency(curr.income)}, expenses ${formatCurrency(curr.expenses)}. Previous month: income ${formatCurrency(last.income)}, expenses ${formatCurrency(last.expenses)}.`;

  return (
    <div>
      <p className={css({ srOnly: true })} aria-label={summaryText} />
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={chartData}
          barCategoryGap="30%"
          barGap={2}
          margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            vertical={false}
            strokeDasharray="3 3"
            stroke="var(--colors-border-subtle)"
            strokeOpacity={0.5}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--colors-fg-muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--colors-fg-muted)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--colors-bg-subtle)" }} />
          <Legend
            wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
            formatter={(v: string) => v.charAt(0).toUpperCase() + v.slice(1)}
          />
          <Bar dataKey="income" name="income" fill="var(--colors-income)" radius={[3, 3, 0, 0]} />
          <Bar
            dataKey="expenses"
            name="expenses"
            fill="var(--colors-expense)"
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
