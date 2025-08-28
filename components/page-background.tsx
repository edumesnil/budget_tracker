import type React from "react"

interface PageBackgroundProps {
  children: React.ReactNode
}

export function PageBackground({ children }: PageBackgroundProps) {
  return (
    <div className="flex min-h-screen flex-col relative bg-background">
      {/* Background image overlay */}
      <div
        className="absolute inset-0 z-0 opacity-60 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to bottom right, rgba(227, 255, 204, 0.3), rgba(24, 165, 123, 0.1)), url('https://hebbkx1anhila5yf.public.blob.vercel-storage.com/wesley-tingey-YGf7JK7FcjM-unsplash.jpg-FnoECwUj1Ou0vuGMbttAksCDYat8v5.jpeg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center relative z-10">{children}</div>

      {/* Unsplash credit */}
      <div className="absolute bottom-2 right-2 text-[8px] text-muted-foreground/70 z-10">
        Photo by{" "}
        <a
          href="https://unsplash.com/@wesleyphotography?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash"
          className="hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Wesley Tingey
        </a>{" "}
        on{" "}
        <a
          href="https://unsplash.com/photos/white-artwork-YGf7JK7FcjM?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash"
          className="hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Unsplash
        </a>
      </div>
    </div>
  )
}

