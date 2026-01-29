import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, isSession } from '@/lib/auth-helper'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

/**
 * GET /api/audience/[id]
 * Returns a single audience member with full details including client info
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  // Check authentication
  const authResult = await requireAuth()
  if (!isSession(authResult)) {
    return authResult
  }

  try {
    const { id } = await params
    const audienceId = parseInt(id, 10)

    if (isNaN(audienceId)) {
      return NextResponse.json(
        { error: 'Invalid audience member ID' },
        { status: 400 }
      )
    }

    const audienceMember = await prisma.audienceMember.findUnique({
      where: {
        id: audienceId,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            sftpHost: true,
            isActive: true,
          },
        },
      },
    })

    if (!audienceMember) {
      return NextResponse.json(
        { error: 'Audience member not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(audienceMember)
  } catch (error) {
    console.error('Error fetching audience member:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audience member' },
      { status: 500 }
    )
  }
}
