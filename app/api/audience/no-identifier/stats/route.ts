import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, isSession } from '@/lib/auth-helper'

/**
 * GET /api/audience/no-identifier/stats
 * Returns statistics for NO_IDENTIFIER records
 */
export async function GET() {
  // Check authentication
  const authResult = await requireAuth()
  if (!isSession(authResult)) {
    return authResult
  }

  try {
    // Execute all queries in parallel
    const [total, missingEmailOnly, missingPhoneOnly, missingBoth, byClient, oldestRecord] = await Promise.all([
      // Total NO_IDENTIFIER records
      prisma.audienceMember.count({
        where: { status: 'NO_IDENTIFIER' },
      }),

      // Missing Email Only (has phone, no email)
      prisma.audienceMember.count({
        where: {
          status: 'NO_IDENTIFIER',
          email: null,
          phone: { not: null },
        },
      }),

      // Missing Phone Only (has email, no phone)
      prisma.audienceMember.count({
        where: {
          status: 'NO_IDENTIFIER',
          phone: null,
          email: { not: null },
        },
      }),

      // Missing Both (neither email nor phone)
      prisma.audienceMember.count({
        where: {
          status: 'NO_IDENTIFIER',
          email: null,
          phone: null,
        },
      }),

      // Count by client
      prisma.audienceMember.groupBy({
        by: ['clientId'],
        where: { status: 'NO_IDENTIFIER' },
        _count: { id: true },
      }),

      // Oldest NO_IDENTIFIER record
      prisma.audienceMember.findFirst({
        where: { status: 'NO_IDENTIFIER' },
        orderBy: { dateAdded: 'asc' },
        select: { dateAdded: true },
      }),
    ])

    // Get client names
    const clientIds = byClient.map((c: (typeof byClient)[number]) => c.clientId)
    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true },
    })

    const clientMap = new Map(clients.map((c: (typeof clients)[number]) => [c.id, c.name]))

    // Format byClient with names
    const byClientWithNames = byClient.map((item: (typeof byClient)[number]) => ({
      clientId: item.clientId,
      clientName: clientMap.get(item.clientId) || 'Unknown',
      count: item._count.id,
    }))

    // Sort by count descending
    byClientWithNames.sort((a: (typeof byClientWithNames)[number], b: (typeof byClientWithNames)[number]) => b.count - a.count)

    // Validate breakdown totals match
    const breakdownSum = missingEmailOnly + missingPhoneOnly + missingBoth
    const isValid = breakdownSum === total

    return NextResponse.json({
      total,
      missingEmailOnly,
      missingPhoneOnly,
      missingBoth,
      byClient: byClientWithNames,
      oldestDate: oldestRecord?.dateAdded?.toISOString() || null,
      breakdownValid: isValid,
    })
  } catch (error) {
    console.error('Error fetching no-identifier stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}
