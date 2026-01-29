import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth, isSession } from '@/lib/auth-helper'
import {
  createCustomerList,
  formatAudienceData,
  uploadToCustomerList,
  type AudienceMember,
} from '@/lib/meta-api'
import { safeLog } from '@/lib/logger'

// Request body validation schema
const syncRequestSchema = z.object({
  clientId: z.number().int().positive('Client ID must be a positive integer'),
  audienceName: z.string().min(1).max(255).optional(),
})

interface SyncResponse {
  success: boolean
  audienceId: string
  audienceName: string
  recordsSynced: number
  syncTime: number
}

interface ErrorResponse {
  success: false
  error: string
}

/**
 * POST /api/meta/sync
 * Syncs active audience members to Meta Custom Audience
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<SyncResponse | ErrorResponse>> {
  // Check authentication
  const authResult = await requireAuth()
  if (!isSession(authResult)) {
    return authResult as NextResponse<ErrorResponse>
  }

  const startTime = Date.now()
  let logId: number | null = null
  let clientName = 'unknown'
  let audienceId: string | null = null

  try {
    // Parse and validate request body
    const body = await request.json()
    const validationResult = syncRequestSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: validationResult.error.errors[0].message },
        { status: 400 }
      )
    }

    const { clientId, audienceName: requestedAudienceName } = validationResult.data

    // Step 1: Validate client exists and is active
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        isActive: true,
        metaAudienceId: true,
      },
    })

    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Client not found' },
        { status: 404 }
      )
    }

    clientName = client.name

    if (!client.isActive) {
      return NextResponse.json(
        { success: false, error: 'Client is not active' },
        { status: 400 }
      )
    }

    safeLog({
      event: 'meta_sync_start',
      clientName: client.name,
      timestamp: new Date().toISOString(),
    })

    // Step 2: Fetch all active audience members (daysRemaining > 0)
    const audienceMembers = await prisma.audienceMember.findMany({
      where: {
        clientId,
        daysRemaining: {
          gt: 0,
        },
      },
      select: {
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
      },
    })

    safeLog({
      event: 'meta_sync_members_fetched',
      clientName: client.name,
      recordsFound: audienceMembers.length,
      timestamp: new Date().toISOString(),
    })

    // Determine audience name
    const audienceName = requestedAudienceName || `${client.name} Audience`

    // Step 3: Check if client has existing metaAudienceId
    if (client.metaAudienceId) {
      audienceId = client.metaAudienceId
      safeLog({
        event: 'meta_sync_using_existing',
        clientName: client.name,
        timestamp: new Date().toISOString(),
      })
    } else {
      // Create new Custom Audience
      safeLog({
        event: 'meta_sync_creating_audience',
        clientName: client.name,
        timestamp: new Date().toISOString(),
      })

      try {
        audienceId = await createCustomerList(
          audienceName,
          `Automated sync from ${client.name}`
        )

        // Save audienceId to clients table
        await prisma.client.update({
          where: { id: clientId },
          data: { metaAudienceId: audienceId },
        })

        safeLog({
          event: 'meta_sync_audience_created',
          clientName: client.name,
          status: 'success',
          timestamp: new Date().toISOString(),
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to create audience'

        // Log failed sync
        await prisma.metaSyncLog.create({
          data: {
            clientId,
            syncType: 'add',
            status: 'failed',
            errorMessage: errorMessage,
            recordsTotal: audienceMembers.length,
            recordsSuccess: 0,
            recordsFailed: audienceMembers.length,
          },
        })

        safeLog({
          event: 'meta_sync_create_failed',
          clientName: client.name,
          status: 'error',
          timestamp: new Date().toISOString(),
        })

        return NextResponse.json(
          { success: false, error: errorMessage },
          { status: 500 }
        )
      }
    }

    // Create sync log entry (status: 'processing')
    const syncLog = await prisma.metaSyncLog.create({
      data: {
        clientId,
        audienceId,
        syncType: 'add',
        status: 'processing',
        recordsTotal: audienceMembers.length,
        recordsSuccess: 0,
        recordsFailed: 0,
      },
    })
    logId = syncLog.id

    // Handle case with no active members (not an error)
    if (audienceMembers.length === 0) {
      await prisma.metaSyncLog.update({
        where: { id: logId },
        data: {
          status: 'completed',
          recordsSuccess: 0,
        },
      })

      const syncTime = Date.now() - startTime

      safeLog({
        event: 'meta_sync_complete',
        clientName: client.name,
        recordsFound: 0,
        status: 'success',
        timestamp: new Date().toISOString(),
      })

      return NextResponse.json({
        success: true,
        audienceId,
        audienceName,
        recordsSynced: 0,
        syncTime,
      })
    }

    // Step 4: Format audience data
    const formattedMembers: AudienceMember[] = audienceMembers.map((m) => ({
      email: m.email,
      phone: m.phone,
      firstName: m.firstName || '',
      lastName: m.lastName || '',
    }))

    const formattedData = formatAudienceData(formattedMembers)

    // Step 5: Upload to Meta
    try {
      const uploadResult = await uploadToCustomerList(
        audienceId,
        formattedData,
        client.name
      )

      const syncTime = Date.now() - startTime

      // Step 6: Update sync log (status: 'completed')
      await prisma.metaSyncLog.update({
        where: { id: logId },
        data: {
          status: 'completed',
          recordsSuccess: uploadResult.recordsUploaded,
          recordsFailed: formattedData.length - uploadResult.recordsUploaded,
        },
      })

      safeLog({
        event: 'meta_sync_complete',
        clientName: client.name,
        recordsFound: uploadResult.recordsUploaded,
        status: 'success',
        timestamp: new Date().toISOString(),
      })

      // Step 7: Return summary
      return NextResponse.json({
        success: true,
        audienceId,
        audienceName,
        recordsSynced: uploadResult.recordsUploaded,
        syncTime,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'

      // Update log with failure
      await prisma.metaSyncLog.update({
        where: { id: logId },
        data: {
          status: 'failed',
          errorMessage: errorMessage,
          recordsFailed: formattedData.length,
        },
      })

      safeLog({
        event: 'meta_sync_upload_failed',
        clientName: client.name,
        status: 'error',
        timestamp: new Date().toISOString(),
      })

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 500 }
      )
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Sync failed'

    // Update log if we have one
    if (logId) {
      await prisma.metaSyncLog.update({
        where: { id: logId },
        data: {
          status: 'failed',
          errorMessage: errorMessage,
        },
      }).catch(() => {
        // Ignore errors updating the log
      })
    }

    safeLog({
      event: 'meta_sync_error',
      clientName,
      status: 'error',
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
