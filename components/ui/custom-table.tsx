import type * as React from "react"
import { cn } from "@/lib/utils"

// Custom table components that support rounded hover states
export function CustomTable({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("w-full", className)} {...props} />
}

export function CustomTableHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("grid items-center gap-4 py-4 text-sm font-medium text-muted-foreground", className)}
      {...props}
    />
  )
}

export function CustomTableBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("divide-y-0", className)} {...props} />
}

export function CustomTableRow({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "grid items-center gap-4 py-3 px-2 transition-colors hover:bg-[#f0f8e8] dark:hover:bg-sidebar-accent/20 rounded-lg",
        className,
      )}
      {...props}
    />
  )
}

export function CustomTableCell({
  className,
  align = "left",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { align?: "left" | "right" | "center" }) {
  return (
    <div
      className={cn(
        "flex items-center",
        align === "right" && "justify-end text-right",
        align === "center" && "justify-center text-center",
        className,
      )}
      {...props}
    />
  )
}

export function CustomTableHeaderCell({
  className,
  align = "left",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { align?: "left" | "right" | "center" }) {
  return (
    <div
      className={cn("font-medium", align === "right" && "text-right", align === "center" && "text-center", className)}
      {...props}
    />
  )
}

