import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, isSession } from '@/lib/auth-helper'

/**
 * GET /api/clients/[id]/files
 * Returns all files processed for a specific client
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) {
    return authResult
  }

  try {
    const { id } = params
    const clientId = parseInt(id, 10)

    if (isNaN(clientId)) {
      return NextResponse.json(
        { error: 'Invalid client ID' },
        { status: 400 }
      )
    }

    // Fetch all file processing logs for this client
    const files = await prisma.fileProcessingLog.findMany({
      where: { clientId },
      orderBy: { processedAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        processedAt: true,
        recordsTotal: true,
        recordsNew: true,
        recordsUpdated: true,
        recordsSkipped: true,
        recordsNoIdentifier: true,
        status: true,
        errorMessage: true,
      },
      take: 50, // Limit to last 50 files
    })

    return NextResponse.json({ files })
  } catch (error) {
    console.error('Error fetching client files:', error)
    return NextResponse.json(
      { error: 'Failed to fetch files' },
      { status: 500 }
    )
  }
}
