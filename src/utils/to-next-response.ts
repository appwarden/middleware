import { NextResponse } from "next/server"

/**
 * Converts a standard Web Response into a NextResponse.
 *
 * This preserves the original body, status, and headers while returning a
 * framework-specific response type for Next.js adapters.
 */
export const toNextResponse = (response: Response): NextResponse => {
  return new NextResponse(response.body, response)
}
