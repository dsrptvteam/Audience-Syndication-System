import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, isSession } from '@/lib/auth-helper'
import { parseCSV, type ParsedRecord } from '@/lib/csv-parser'
import { formatAudienceData, removeFromCustomerList, type AudienceMember } from '@/lib/meta-api'
import { safeLog } from '@/lib/logger'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

interface UploadResponse {
  success: boolean
  fileName: string
  recordsProcessed: number
  matchesFound: number
  removedFromAudience: number
  removedFromMeta: number
  notFound: number
}

interface ErrorResponse {
  success: false
  error: string
}

interface MatchedRecord {
  audienceMemberId: number
  record: ParsedRecord
}

/**
 * POST /api/purchases/upload
 * Upload purchase list CSV, match against audience, remove from Meta
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<UploadResponse | ErrorResponse>> {
  // Check authentication
  const authResult = await requireAuth()
  if (!isSession(authResult)) {
    return authResult as NextResponse<ErrorResponse>
  }

  let clientName = 'unknown'

  try {
    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const clientIdStr = formData.get('clientId') as string | null

    // Validate file
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json(
        { success: false, error: 'Only CSV files allowed' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File exceeds 10MB limit' },
        { status: 413 }
      )
    }

    // Validate clientId
    if (!clientIdStr) {
      return NextResponse.json(
        { success: false, error: 'clientId is required' },
        { status: 400 }
      )
    }

    const clientId = parseInt(clientIdStr, 10)
    if (isNaN(clientId) || clientId < 1) {
      return NextResponse.json(
        { success: false, error: 'Invalid clientId' },
        { status: 400 }
      )
    }

    // Validate client exists and has Meta audience
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, metaAudienceId: true, isActive: true },
    })

    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Client not found' },
        { status: 404 }
      )
    }

    clientName = client.name

    if (!client.metaAudienceId) {
      return NextResponse.json(
        { success: false, error: 'Client has no Meta audience configured' },
        { status: 400 }
      )
    }

    // Read file content
    const csvContent = await file.text()

    safeLog({
      event: 'purchase_upload_start',
      clientName: client.name,
      filename: file.name,
      timestamp: new Date().toISOString(),
    })

    // Parse CSV
    let parsedRecords: ParsedRecord[]
    try {
      parsedRecords = parseCSV(csvContent)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'CSV parsing failed'
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 400 }
      )
    }

    safeLog({
      event: 'purchase_upload_parsed',
      clientName: client.name,
      filename: file.name,
      recordsFound: parsedRecords.length,
      timestamp: new Date().toISOString(),
    })

    // Match records against audience
    const matchedRecords: MatchedRecord[] = []
    const notFoundRecords: ParsedRecord[] = []

    for (const record of parsedRecords) {
      const match = await findAudienceMatch(record, clientId)
      if (match) {
        matchedRecords.push({ audienceMemberId: match.id, record })
      } else {
        notFoundRecords.push(record)
      }
    }

    safeLog({
      event: 'purchase_upload_matched',
      clientName: client.name,
      recordsFound: matchedRecords.length,
      status: 'success',
      timestamp: new Date().toISOString(),
    })

    // Process matched records
    let removedFromAudience = 0
    let removedFromMeta = 0

    if (matchedRecords.length > 0) {
      // Delete from audience_members and insert into purchase_removals
      for (const { audienceMemberId, record } of matchedRecords) {
        try {
          // Delete from audience_members
          await prisma.audienceMember.delete({
            where: { id: audienceMemberId },
          })

          // Insert into purchase_removals
          await prisma.purchaseRemoval.create({
            data: {
              clientId,
              email: record.email,
              phone: record.phone,
              firstName: record.firstName,
              lastName: record.lastName,
              sourceFile: file.name,
            },
          })

          removedFromAudience++
        } catch {
          // Log but continue processing
          safeLog({
            event: 'purchase_upload_delete_error',
            clientName: client.name,
            status: 'error',
            timestamp: new Date().toISOString(),
          })
        }
      }

      // Format data for Meta removal
      const audienceMembers: AudienceMember[] = matchedRecords.map(({ record }) => ({
        email: record.email,
        phone: record.phone,
        firstName: record.firstName,
        lastName: record.lastName,
      }))

      const formattedData = formatAudienceData(audienceMembers)

      // Remove from Meta
      if (formattedData.length > 0) {
        try {
          const removeResult = await removeFromCustomerList(
            client.metaAudienceId,
            formattedData,
            client.name
          )

          removedFromMeta = removeResult.recordsUploaded

          // Log to meta_sync_log
          await prisma.metaSyncLog.create({
            data: {
              clientId,
              audienceId: client.metaAudienceId,
              syncType: 'remove',
              status: 'completed',
              recordsTotal: formattedData.length,
              recordsSuccess: removedFromMeta,
              recordsFailed: formattedData.length - removedFromMeta,
            },
          })

          safeLog({
            event: 'purchase_upload_meta_removed',
            clientName: client.name,
            recordsFound: removedFromMeta,
            status: 'success',
            timestamp: new Date().toISOString(),
          })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Meta removal failed'

          // Log failed Meta sync
          await prisma.metaSyncLog.create({
            data: {
              clientId,
              audienceId: client.metaAudienceId,
              syncType: 'remove',
              status: 'failed',
              recordsTotal: formattedData.length,
              recordsSuccess: 0,
              recordsFailed: formattedData.length,
              errorMessage: errorMessage,
            },
          })

          safeLog({
            event: 'purchase_upload_meta_failed',
            clientName: client.name,
            status: 'error',
            timestamp: new Date().toISOString(),
          })

          // Don't fail the entire request, just report 0 removed from Meta
          // The records are already removed from the database
        }
      }
    }

    safeLog({
      event: 'purchase_upload_complete',
      clientName: client.name,
      filename: file.name,
      recordsFound: parsedRecords.length,
      status: 'success',
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      fileName: file.name,
      recordsProcessed: parsedRecords.length,
      matchesFound: matchedRecords.length,
      removedFromAudience,
      removedFromMeta,
      notFound: notFoundRecords.length,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Upload failed'

    safeLog({
      event: 'purchase_upload_error',
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

/**
 * Find matching audience member using progressive matching
 * Step 1: email + firstName + lastName (case-insensitive)
 * Step 2: phone + firstName + lastName
 */
async function findAudienceMatch(
  record: ParsedRecord,
  clientId: number
): Promise<{ id: number } | null> {
  // Step 1: Email + Name match
  if (record.email) {
    const emailMatch = await prisma.audienceMember.findFirst({
      where: {
        clientId,
        email: {
          equals: record.email,
          mode: 'insensitive',
        },
        firstName: {
          equals: record.firstName,
          mode: 'insensitive',
        },
        lastName: {
          equals: record.lastName,
          mode: 'insensitive',
        },
      },
      select: { id: true },
    })

    if (emailMatch) {
      return emailMatch
    }
  }

  // Step 2: Phone + Name match
  if (record.phone) {
    const phoneMatch = await prisma.audienceMember.findFirst({
      where: {
        clientId,
        phone: {
          equals: record.phone,
        },
        firstName: {
          equals: record.firstName,
          mode: 'insensitive',
        },
        lastName: {
          equals: record.lastName,
          mode: 'insensitive',
        },
      },
      select: { id: true },
    })

    if (phoneMatch) {
      return phoneMatch
    }
  }

  return null
}
