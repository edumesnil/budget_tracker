import { Coins } from "lucide-react"

export function Logo() {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#b2f076] shrink-0">
        <Coins className="h-5 w-5 text-[#1a2b32]" />
      </div>
      <span className="text-xl font-bold whitespace-nowrap overflow-hidden transition-all duration-300 max-w-full group-data-[collapsed=true]:max-w-0">
        Moneo
      </span>
    </div>
  )
}

