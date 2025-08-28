import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PageBackground } from "@/components/page-background"

export default function HomePage() {
  return (
    <PageBackground>
      <div className="container px-4 md:px-6 text-center">
        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl mb-6">
          Simplify Your Family Budget
        </h1>
        <p className="mt-4 max-w-[600px] mx-auto text-muted-foreground md:text-xl">
          Track expenses, set budgets, and gain insights into your family's spending habits.
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row justify-center">
          <Link href="/register">
            <Button size="lg" className="w-full sm:w-auto">
              Get Started
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              Login
            </Button>
          </Link>
        </div>
      </div>
    </PageBackground>
  )
}

