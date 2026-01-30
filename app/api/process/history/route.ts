import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, isSession } from '@/lib/auth-helper'

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 100

interface HistoryEntry {
  id: number
  clientId: number
  clientName: string
  fileName: string
  status: string
  recordsTotal: number
  recordsNew: number
  recordsUpdated: number
  recordsSkipped: number
  errorMessage: string | null
  processedAt: Date
}

interface HistoryResponse {
  data: HistoryEntry[]
  pagination: {
    limit: number
    total: number
  }
}

/**
 * GET /api/process/history
 * Returns recent file_processing_log entries for a client
 *
 * Query params:
 * - clientId: Required, filter by client
 * - limit: Optional, max entries to return (default: 10, max: 100)
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<HistoryResponse | { error: string }>> {
  // Check authentication
  const authResult = await requireAuth()
  if (!isSession(authResult)) {
    return authResult as NextResponse<{ error: string }>
  }

  try {
    const { searchParams } = new URL(request.url)

    // Parse clientId (required)
    const clientIdParam = searchParams.get('clientId')
    if (!clientIdParam) {
      return NextResponse.json(
        { error: 'clientId is required' },
        { status: 400 }
      )
    }

    const clientId = parseInt(clientIdParam, 10)
    if (isNaN(clientId) || clientId < 1) {
      return NextResponse.json(
        { error: 'Invalid clientId' },
        { status: 400 }
      )
    }

    // Parse limit (optional)
    const limitParam = searchParams.get('limit')
    let limit = DEFAULT_LIMIT
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10)
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = Math.min(parsedLimit, MAX_LIMIT)
      }
    }

    // Verify client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true },
    })

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      )
    }

    // Query file processing logs
    const [logs, total] = await Promise.all([
      prisma.fileProcessingLog.findMany({
        where: { clientId },
        orderBy: { processedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          clientId: true,
          fileName: true,
          status: true,
          recordsTotal: true,
          recordsNew: true,
          recordsUpdated: true,
          recordsSkipped: true,
          errorMessage: true,
          processedAt: true,
        },
      }),
      prisma.fileProcessingLog.count({ where: { clientId } }),
    ])

    // Add client name to each entry
    const data: HistoryEntry[] = logs.map((log: { id: number; clientId: number; fileName: string; status: string; recordsTotal: number; recordsNew: number; recordsUpdated: number; recordsSkipped: number; errorMessage: string | null; processedAt: Date }) => ({
      ...log,
      clientName: client.name,
    }))

    return NextResponse.json({
      data,
      pagination: {
        limit,
        total,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch history'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
