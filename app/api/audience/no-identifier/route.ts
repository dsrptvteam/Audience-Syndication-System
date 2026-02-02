import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, isSession } from '@/lib/auth-helper'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 10000

/**
 * GET /api/audience/no-identifier
 * Returns paginated audience members with NO_IDENTIFIER status
 *
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 10000 for export)
 * - clientId: Filter by client ID
 * - search: Search in firstName, lastName
 */
export async function GET(request: NextRequest) {
  // Check authentication
  const authResult = await requireAuth()
  if (!isSession(authResult)) {
    return authResult
  }

  try {
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const pageParam = searchParams.get('page')
    const limitParam = searchParams.get('limit')
    const clientIdParam = searchParams.get('clientId')
    const search = searchParams.get('search')

    let page = DEFAULT_PAGE
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

    let clientId: number | undefined
    if (clientIdParam && clientIdParam !== 'all') {
      const parsedClientId = parseInt(clientIdParam, 10)
      if (!isNaN(parsedClientId) && parsedClientId > 0) {
        clientId = parsedClientId
      }
    }

    // Build where clause - only NO_IDENTIFIER records
    const where: {
      status: string
      clientId?: number
      OR?: Array<{
        firstName?: { contains: string; mode: 'insensitive' }
        lastName?: { contains: string; mode: 'insensitive' }
      }>
    } = {
      status: 'NO_IDENTIFIER',
    }

    if (clientId) {
      where.clientId = clientId
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Calculate pagination
    const skip = (page - 1) * limit

    // Execute queries in parallel
    const [members, total] = await Promise.all([
      prisma.audienceMember.findMany({
        where,
        orderBy: { dateAdded: 'desc' },
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
      prisma.audienceMember.count({ where }),
    ])

    // Calculate total pages
    const totalPages = Math.ceil(total / limit)

    // Transform response
    const data = members.map((m) => ({
      id: m.id.toString(),
      firstName: m.firstName,
      lastName: m.lastName,
      email: m.email,
      phone: m.phone,
      sourceFile: m.sourceFile,
      dateAdded: m.dateAdded.toISOString(),
      client: {
        id: m.client.id.toString(),
        name: m.client.name,
      },
    }))

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    console.error('Error fetching no-identifier members:', error)
    return NextResponse.json(
      { error: 'Failed to fetch records' },
      { status: 500 }
    )
  }
}
