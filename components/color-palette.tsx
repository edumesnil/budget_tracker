"use client"

import { cn } from "@/lib/utils"

// Update the color palette with the new refined colors
export const colorPalette = [
  // Primary teal/green colors
  "#18a57b", // Teal
  "#0b363c", // Dark teal
  "#162e33", // Deep teal
  "#14b8a6", // Light teal
  "#0ea5e9", // Sky blue
  "#06b6d4", // Cyan

  // Mint green colors
  "#e3ffcc", // Light mint
  "#e7fecb", // Very light mint
  "#d1f7c4", // Soft mint
  "#b5e8a5", // Medium mint
  "#84cc16", // Lime
  "#22c55e", // Green

  // Warm colors
  "#f97316", // Orange
  "#f59e0b", // Amber
  "#eab308", // Yellow
  "#ef4444", // Red
  "#ec4899", // Pink

  // Cool colors
  "#a855f7", // Purple
  "#8b5cf6", // Violet
  "#6366f1", // Indigo
  "#3b82f6", // Blue

  // Neutral colors
  "#64748b", // Slate
  "#6b7280", // Gray
  "#71717a", // Zinc
  "#737373", // Neutral
  "#78716c", // Stone
]

type ColorPaletteProps = {
  value: string
  onValueChange: (value: string) => void
  className?: string
  inDialog?: boolean
}

export function ColorPalette({ value, onValueChange, className, inDialog = false }: ColorPaletteProps) {
  const handleSelectColor = (color: string) => {
    console.log(`[ColorPalette] Selected color: ${color}`)
    onValueChange(color)
  }

  return (
    <div className={cn("grid grid-cols-5 gap-3 p-4", className)}>
      {colorPalette.map((color) => (
        <button
          key={color}
          type="button"
          className={cn(
            "h-10 w-10 rounded-full border-2 transition-all flex items-center justify-center",
            value === color ? "border-primary ring-2 ring-primary/30" : "border-transparent",
          )}
          style={{ backgroundColor: color }}
          onClick={() => handleSelectColor(color)}
          aria-label={`Select color ${color}`}
        >
          {value === color && <div className="bg-white rounded-full h-2 w-2" />}
        </button>
      ))}
    </div>
  )
}

