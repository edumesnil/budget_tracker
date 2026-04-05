import { lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "@/lib/query-client";
import { AuthProvider } from "@/hooks/use-auth";
import { DashboardLayout } from "@/routes/_layout";
import IndexPage from "@/routes/index";
import LoginPage from "@/routes/login";
import RegisterPage from "@/routes/register";

// Lazy-loaded dashboard routes — each gets its own chunk
const DashboardPage = lazy(() => import("@/routes/dashboard"));
const TransactionsPage = lazy(() => import("@/routes/transactions"));
const BudgetsPage = lazy(() => import("@/routes/budgets"));
const CategoriesPage = lazy(() => import("@/routes/categories"));
const ImportPage = lazy(() => import("@/routes/import"));

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route index element={<IndexPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />

            {/* Dashboard routes — wrapped in layout with auth guard */}
            <Route element={<DashboardLayout />}>
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="transactions" element={<TransactionsPage />} />
              <Route path="budgets" element={<BudgetsPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="import" element={<ImportPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
