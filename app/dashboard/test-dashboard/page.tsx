import { TestDashboard } from "@/components/dashboard/test-dashboard"
import { PageHeader } from "@/components/shared/page-header"

export default function TestDashboardPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        heading="Test Dashboard (React Query)"
        subheading="Testing the React Query implementation of useDashboardData"
      />
      <TestDashboard />
    </div>
  )
}

