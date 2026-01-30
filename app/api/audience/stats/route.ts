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
    const [
      totalActive,
      byClient,
      expiringSoon,
      addedToday,
    ] = await Promise.all([
      // Total active audience members
      prisma.audienceMember.count(),

      // Total by client (breakdown)
      prisma.audienceMember.groupBy({
        by: ['clientId'],
        _count: {
          id: true,
        },
      }),

      // Members expiring soon (daysRemaining < 7)
      prisma.audienceMember.count({
        where: {
          daysRemaining: {
            lt: 7,
          },
        },
      }),

      // Members added today
      prisma.audienceMember.count({
        where: {
          dateAdded: {
            gte: today,
          },
        },
      }),
    ])

    // Get client names for the breakdown
    const clientIds = byClient.map((c: { clientId: number; _count: { id: number } }) => c.clientId)
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
    const clientMap = new Map(clients.map((c: { id: number; name: string }) => [c.id, c.name]))
    const byClientWithNames = byClient.map((item: { clientId: number; _count: { id: number } }) => ({
      clientId: item.clientId,
      clientName: clientMap.get(item.clientId) || 'Unknown',
      count: item._count.id,
    }))

    return NextResponse.json({
      totalActive,
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
