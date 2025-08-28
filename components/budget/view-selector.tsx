"use client"

import { Button } from "@/components/ui/button"
import { Calendar, BarChart3 } from "lucide-react"

type ViewSelectorProps = {
  activeView: "monthly" | "annual"
  onViewChange: (view: "monthly" | "annual") => void
}

export function ViewSelector({ activeView, onViewChange }: ViewSelectorProps) {
  return (
    <div className="flex items-center border rounded-md overflow-hidden">
      <Button
        variant={activeView === "monthly" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewChange("monthly")}
        className={`rounded-none border-r ${activeView === "monthly" ? "bg-primary text-primary-foreground" : "bg-secondary/70 text-foreground hover:bg-accent hover:text-accent-foreground"}`}
      >
        <Calendar className="h-4 w-4 mr-2" />
        Monthly
      </Button>
      <Button
        variant={activeView === "annual" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewChange("annual")}
        className={`rounded-none ${activeView === "annual" ? "bg-primary text-primary-foreground" : "bg-secondary/70 text-foreground hover:bg-accent hover:text-accent-foreground"}`}
      >
        <BarChart3 className="h-4 w-4 mr-2" />
        Annual
      </Button>
    </div>
  )
}

