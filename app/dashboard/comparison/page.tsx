import { DashboardComparison } from "@/components/dashboard/dashboard-comparison"
import { PageHeader } from "@/components/shared/page-header"

export default function DashboardComparisonPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        heading="Dashboard Implementation Comparison"
        subheading="Compare original implementation with React Query version"
      />
      <DashboardComparison />
    </div>
  )
}

