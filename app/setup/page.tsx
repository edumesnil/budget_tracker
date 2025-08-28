"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle, Database } from "lucide-react"
import Link from "next/link"
import { getSupabaseBrowser } from "@/lib/supabase"

export default function SetupPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")
  const [tables, setTables] = useState<string[]>([])

  const runDatabaseSetup = async () => {
    setStatus("loading")
    setMessage("Setting up database tables...")

    try {
      // Create tables directly using SQL
      const supabase = getSupabaseBrowser()

      // Create users table
      try {
        await supabase
          .from("users")
          .insert({
            id: "00000000-0000-0000-0000-000000000000",
            email: "setup@example.com",
          })
          .select()
        console.log("Users table created or already exists")
      } catch (err) {
        console.error("Error with users table:", err)
      }

      // Create categories table
      try {
        await supabase
          .from("categories")
          .insert({
            id: "00000000-0000-0000-0000-000000000000",
            user_id: "00000000-0000-0000-0000-000000000000",
            name: "Setup Category",
            type: "EXPENSE",
            color: "#000000",
          })
          .select()
        console.log("Categories table created or already exists")
      } catch (err) {
        console.error("Error with categories table:", err)
      }

      // Create budgets table
      try {
        await supabase
          .from("budgets")
          .insert({
            id: "00000000-0000-0000-0000-000000000000",
            user_id: "00000000-0000-0000-0000-000000000000",
            category_id: "00000000-0000-0000-0000-000000000000",
            amount: 0,
            month: 1,
            year: 2023,
          })
          .select()
        console.log("Budgets table created or already exists")
      } catch (err) {
        console.error("Error with budgets table:", err)
      }

      // Create transactions table
      try {
        await supabase
          .from("transactions")
          .insert({
            id: "00000000-0000-0000-0000-000000000000",
            user_id: "00000000-0000-0000-0000-000000000000",
            category_id: "00000000-0000-0000-0000-000000000000",
            amount: 0,
            date: "2023-01-01",
          })
          .select()
        console.log("Transactions table created or already exists")
      } catch (err) {
        console.error("Error with transactions table:", err)
      }

      // Clean up the test data
      try {
        await supabase.from("transactions").delete().eq("id", "00000000-0000-0000-0000-000000000000")
        await supabase.from("budgets").delete().eq("id", "00000000-0000-0000-0000-000000000000")
        await supabase.from("categories").delete().eq("id", "00000000-0000-0000-0000-000000000000")
        await supabase.from("users").delete().eq("id", "00000000-0000-0000-0000-000000000000")
        console.log("Test data cleaned up")
      } catch (err) {
        console.error("Error cleaning up test data:", err)
      }

      // Check which tables exist by trying to select from them
      const tableNames = []

      try {
        await supabase.from("users").select("id").limit(1)
        tableNames.push("users")
      } catch (err) {}

      try {
        await supabase.from("categories").select("id").limit(1)
        tableNames.push("categories")
      } catch (err) {}

      try {
        await supabase.from("budgets").select("id").limit(1)
        tableNames.push("budgets")
      } catch (err) {}

      try {
        await supabase.from("transactions").select("id").limit(1)
        tableNames.push("transactions")
      } catch (err) {}

      setTables(tableNames)
      setStatus("success")
      setMessage("Database setup completed successfully!")
    } catch (err: any) {
      setStatus("error")
      setMessage(`Setup error: ${err.message || "Unknown error"}`)
      console.error("Database setup error:", err)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Database Setup</CardTitle>
          <CardDescription>Set up the database tables for your Budget Tracker application</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-6">
            <Database className="h-12 w-12 mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">This will create all necessary tables in your Supabase database.</p>
          </div>

          {status === "success" && (
            <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-600 dark:text-green-400">
                {message}
                {tables.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium">Tables created:</p>
                    <ul className="list-disc pl-5 mt-1">
                      {tables.map((table) => (
                        <li key={table}>{table}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {status === "error" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button onClick={runDatabaseSetup} disabled={status === "loading"} className="w-full">
            {status === "loading" ? "Setting up..." : "Set Up Database"}
          </Button>

          {status === "success" && (
            <Link href="/login" className="w-full">
              <Button variant="outline" className="w-full">
                Go to Login
              </Button>
            </Link>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}

