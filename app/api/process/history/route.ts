import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, isSession } from '@/lib/auth-helper'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

interface ProcessingLog {
  id: string
  fileName: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  totalRecords: number | null
  newRecords: number | null
  duplicateRecords: number | null
  errorMessage: string | null
  startedAt: string
  completedAt: string | null
  client: {
    id: string
    name: string
  }
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface HistoryResponse {
  logs: ProcessingLog[]
  pagination: PaginationInfo
}

/**
 * GET /api/process/history
 * Returns file_processing_log entries with optional filtering
 *
 * Query params:
 * - clientId: Optional, filter by client (omit or "all" for all clients)
 * - status: Optional, filter by status (omit or "all" for all statuses)
 * - page: Optional, page number (default: 1)
 * - limit: Optional, entries per page (default: 20, max: 100)
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

    // Parse clientId (optional - "all" or omitted means all clients)
    const clientIdParam = searchParams.get('clientId')
    let clientId: number | undefined
    if (clientIdParam && clientIdParam !== 'all') {
      const parsed = parseInt(clientIdParam, 10)
      if (!isNaN(parsed) && parsed > 0) {
        clientId = parsed
      }
    }

    // Parse status filter (optional)
    const statusParam = searchParams.get('status')
    let status: string | undefined
    if (statusParam && statusParam !== 'all') {
      status = statusParam
    }

    // Parse pagination
    const pageParam = searchParams.get('page')
    const limitParam = searchParams.get('limit')

    let page = 1
    if (pageParam) {
      const parsedPage = parseInt(pageParam, 10)
      if (!isNaN(parsedPage) && parsedPage > 0) {
        page = parsedPage
      }
    }

    let limit = DEFAULT_LIMIT
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10)
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = Math.min(parsedLimit, MAX_LIMIT)
      }
    }

    // Build where clause
    const where: { clientId?: number; status?: string } = {}
    if (clientId) {
      where.clientId = clientId
    }
    if (status) {
      where.status = status
    }

    // Calculate skip for pagination
    const skip = (page - 1) * limit

    // Query file processing logs with client info
    const [logs, total] = await Promise.all([
      prisma.fileProcessingLog.findMany({
        where,
        orderBy: { processedAt: 'desc' },
        skip,
        take: limit,
        include: {
          client: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.fileProcessingLog.count({ where }),
    ])

    // Transform to match UI expected format
    const formattedLogs: ProcessingLog[] = logs.map((log) => ({
      id: log.id.toString(),
      fileName: log.fileName,
      status: log.status as 'pending' | 'processing' | 'completed' | 'failed',
      totalRecords: log.recordsTotal,
      newRecords: log.recordsNew,
      duplicateRecords: log.recordsSkipped + log.recordsUpdated,
      errorMessage: log.errorMessage,
      startedAt: log.createdAt.toISOString(),
      completedAt: log.processedAt?.toISOString() || null,
      client: {
        id: log.client.id.toString(),
        name: log.client.name,
      },
    }))

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      logs: formattedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
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
