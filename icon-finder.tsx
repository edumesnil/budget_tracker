"use client"

import type React from "react"

import * as LucideIcons from "lucide-react"
import { useEffect, useState } from "react"

export default function IconFinder() {
  const [version, setVersion] = useState<string>("Unknown")
  const [banknoteIcons, setBanknoteIcons] = useState<string[]>([])

  useEffect(() => {
    // Check if LucideIcons has a version property
    if ("__esModule" in LucideIcons && "version" in LucideIcons) {
      setVersion((LucideIcons as any).version || "Unknown")
    }

    // Find all icons with 'banknote' in their name
    const icons = Object.keys(LucideIcons).filter((name) => name.toLowerCase().includes("banknote"))
    setBanknoteIcons(icons)

    // Log to console for debugging
    console.log("Lucide React Version:", (LucideIcons as any).version || "Unknown")
    console.log("Available Banknote Icons:", icons)
  }, [])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Lucide Icon Finder</h1>
      <div className="mb-4 p-3 bg-blue-50 rounded-md">
        <p>
          <strong>Lucide React Version:</strong> {version}
        </p>
        <p>
          <strong>Found {banknoteIcons.length} Banknote Icons</strong>
        </p>
      </div>

      <h2 className="text-xl font-bold mb-2">Available Banknote Icons:</h2>
      {banknoteIcons.length === 0 ? (
        <p className="text-red-500">No banknote icons found!</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {banknoteIcons.map((iconName) => {
            const IconComponent = LucideIcons[iconName] as React.ComponentType<any>
            return (
              <div key={iconName} className="flex items-center gap-3 p-3 border rounded-md hover:bg-gray-50">
                <div className="p-2 bg-gray-100 rounded-md">
                  <IconComponent className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-medium">{iconName}</p>
                  <p className="text-xs text-gray-500">Import: {`import { ${iconName} } from 'lucide-react'`}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-8 p-4 border rounded-md bg-gray-50">
        <h2 className="text-lg font-bold mb-2">Alternative Solution</h2>
        <p className="mb-4">If you can't find the exact icons, use these standard ones instead:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 border rounded-md bg-white">
            <div className="p-2 bg-green-50 rounded-md">
              {LucideIcons.Banknote && <LucideIcons.Banknote className="h-6 w-6 text-green-600" />}
            </div>
            <div>
              <p className="font-medium">Banknote + ArrowDown (for Income)</p>
              <p className="text-xs text-gray-500">
                Use: <code>{"<Banknote /> + <ArrowDown />"}</code>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 border rounded-md bg-white">
            <div className="p-2 bg-red-50 rounded-md">
              {LucideIcons.Banknote && <LucideIcons.Banknote className="h-6 w-6 text-red-600" />}
            </div>
            <div>
              <p className="font-medium">Banknote + ArrowUp (for Expense)</p>
              <p className="text-xs text-gray-500">
                Use: <code>{"<Banknote /> + <ArrowUp />"}</code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

