import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, isSession } from '@/lib/auth-helper'

/**
 * GET /api/audience/stats
 * Returns audience statistics for the dashboard
 */
export async function GET() {
  // Check authentication
  const authResult = await requireAuth()
  if (!isSession(authResult)) {
    return authResult
  }

  try {
    // Get start of today for "added today" calculation
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Execute all queries in parallel for efficiency
    // Only count ACTIVE status records (those with valid identifiers)
    const [
      totalActive,
      totalNoIdentifier,
      byClient,
      expiringSoon,
      addedToday,
    ] = await Promise.all([
      // Total active audience members (with valid identifiers)
      prisma.audienceMember.count({
        where: {
          status: 'ACTIVE',
        },
      }),

      // Total records without identifiers (for data quality reporting)
      prisma.audienceMember.count({
        where: {
          status: 'NO_IDENTIFIER',
        },
      }),

      // Total by client (breakdown) - only ACTIVE records
      prisma.audienceMember.groupBy({
        by: ['clientId'],
        where: {
          status: 'ACTIVE',
        },
        _count: {
          id: true,
        },
      }),

      // Members expiring soon (daysRemaining < 7) - only ACTIVE
      prisma.audienceMember.count({
        where: {
          status: 'ACTIVE',
          daysRemaining: {
            lt: 7,
          },
        },
      }),

      // Members added today - only ACTIVE
      prisma.audienceMember.count({
        where: {
          status: 'ACTIVE',
          dateAdded: {
            gte: today,
          },
        },
      }),
    ])

    // Get client names for the breakdown
    const clientIds = byClient.map((c: (typeof byClient)[number]) => c.clientId)
    const clients = await prisma.client.findMany({
      where: {
        id: {
          in: clientIds,
        },
      },
      select: {
        id: true,
        name: true,
      },
    })

    // Map client names to the breakdown
    const clientMap = new Map(clients.map((c: (typeof clients)[number]) => [c.id, c.name]))
    const byClientWithNames = byClient.map((item: (typeof byClient)[number]) => ({
      clientId: item.clientId,
      clientName: clientMap.get(item.clientId) || 'Unknown',
      count: item._count.id,
    }))

    return NextResponse.json({
      totalActive,
      totalNoIdentifier,
      byClient: byClientWithNames,
      expiringSoon,
      addedToday,
    })
  } catch (error) {
    console.error('Error fetching audience stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audience statistics' },
      { status: 500 }
    )
  }
}
