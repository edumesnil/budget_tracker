import { getIconByName } from "@/utils/icons"
import { CircleDot } from "lucide-react"
import { cn } from "@/lib/utils"

type CategoryIconProps = {
  icon: string | null
  color: string | null
  size?: number
  className?: string
}

export function CategoryIcon({ icon, color, size = 16, className = "" }: CategoryIconProps) {
  // Default color if none is provided
  const iconColor = color || "#18a57b"

  // Create a background color with 15% opacity
  const bgColor = `${iconColor}20`

  // Get the icon component
  const IconComponent = icon ? getIconByName(icon) : CircleDot

  return (
    <div
      className={cn("flex items-center justify-center rounded-md transition-all duration-200", className)}
      style={{
        backgroundColor: bgColor,
        color: iconColor,
        width: `${size * 1.5}px`,
        height: `${size * 1.5}px`,
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
      }}
    >
      <IconComponent size={size} />
    </div>
  )
}

