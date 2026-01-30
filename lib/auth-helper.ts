import { getServerSession, Session } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'

/**
 * Checks if the user is authenticated and returns the session.
 * If not authenticated, returns a 401 Unauthorized response.
 *
 * @returns Session if authenticated, or NextResponse with 401 status
 */
export async function requireAuth(): Promise<Session | NextResponse> {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  return session
}

/**
 * Type guard to check if the result is a Session object
 */
export function isSession(result: Session | NextResponse): result is Session {
  return 'user' in result
}
