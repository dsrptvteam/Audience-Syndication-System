import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { audienceSearchSchema } from '@/lib/validation'
import { requireAuth, isSession } from '@/lib/auth-helper'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20

/**
 * GET /api/audience
 * Returns paginated audience members with optional filtering and search
 *
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - clientId: Filter by client ID
 * - search: Search in firstName, lastName, email, phone
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
    const rawParams = {
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined,
      clientId: searchParams.get('clientId') ? parseInt(searchParams.get('clientId')!, 10) : undefined,
      search: searchParams.get('search') || undefined,
    }

    // Validate parameters
    const validationResult = audienceSearchSchema.safeParse(rawParams)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { page = DEFAULT_PAGE, limit = DEFAULT_LIMIT, clientId, search } = validationResult.data

    // Build where clause for filtering
    const where: {
      clientId?: number
      OR?: Array<{
        email?: { contains: string; mode: 'insensitive' }
        phone?: { contains: string }
        firstName?: { contains: string; mode: 'insensitive' }
        lastName?: { contains: string; mode: 'insensitive' }
      }>
    } = {}

    // Filter by client if provided
    if (clientId) {
      where.clientId = clientId
    }

    // Search across multiple fields if search query provided
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Calculate pagination
    const skip = (page - 1) * limit

    // Execute queries in parallel for efficiency
    const [audienceMembers, total] = await Promise.all([
      prisma.audienceMember.findMany({
        where,
        orderBy: {
          dateAdded: 'desc',
        },
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
    const pages = Math.ceil(total / limit)

    return NextResponse.json({
      data: audienceMembers,
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    })
  } catch (error) {
    console.error('Error fetching audience members:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audience members' },
      { status: 500 }
    )
  }
}
