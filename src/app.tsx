import { BrowserRouter, Routes, Route } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from '@/lib/query-client'
import { DashboardLayout } from '@/routes/_layout'
import IndexPage from '@/routes/index'
import DashboardPage from '@/routes/dashboard'
import TransactionsPage from '@/routes/transactions'
import BudgetsPage from '@/routes/budgets'
import CategoriesPage from '@/routes/categories'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route index element={<IndexPage />} />

          {/* Dashboard routes — wrapped in layout shell */}
          <Route element={<DashboardLayout />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="budgets" element={<BudgetsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
