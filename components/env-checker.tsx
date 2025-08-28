"use client"

import { useEffect, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export function EnvChecker() {
  const [missingVars, setMissingVars] = useState<string[]>([])

  useEffect(() => {
    const requiredVars = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]
    const missing = requiredVars.filter((varName) => !process.env[varName])
    setMissingVars(missing)
  }, [])

  if (missingVars.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 max-w-md z-50">
      <Alert variant="destructive" className="shadow-lg">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="font-bold mb-1">Missing Environment Variables:</div>
          <ul className="list-disc pl-5 text-sm">
            {missingVars.map((varName) => (
              <li key={varName}>{varName}</li>
            ))}
          </ul>
          <div className="mt-2 text-xs">Add these to your .env.local file to enable Supabase functionality.</div>
        </AlertDescription>
      </Alert>
    </div>
  )
}

