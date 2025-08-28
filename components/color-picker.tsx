"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ColorPalette } from "@/components/color-palette"

type ColorPickerProps = {
  color: string
  onChange: (color: string) => void
}

export function ColorPicker({ color, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start text-left font-normal h-10">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-full border border-border" style={{ backgroundColor: color }} />
            <span>{color}</span>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <ColorPalette
          value={color}
          onValueChange={(newColor) => {
            onChange(newColor)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

