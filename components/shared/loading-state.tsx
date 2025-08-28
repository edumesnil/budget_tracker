import type { ReactNode } from "react"

interface LoadingStateProps {
  isLoading: boolean
  isError: boolean
  loadingMessage?: string
  errorMessage?: string
  children: ReactNode
}

export function LoadingState({
  isLoading,
  isError,
  loadingMessage = "Loading...",
  errorMessage = "An error occurred. Please try again.",
  children,
}: LoadingStateProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-muted-foreground">{loadingMessage}</p>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="text-center">
          <div className="bg-red-100 text-red-800 p-4 rounded-lg">
            <p>{errorMessage}</p>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

