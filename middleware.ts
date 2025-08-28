import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// We'll handle auth redirects in the components themselves
export function middleware(request: NextRequest) {
  return NextResponse.next()
}

