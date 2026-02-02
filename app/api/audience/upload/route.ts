import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, isSession } from '@/lib/auth-helper'
import { parseCSV } from '@/lib/csv-parser'
import { processRecords } from '@/lib/deduplication'
import { safeLog } from '@/lib/logger'

interface UploadResponse {
  success: boolean
  total: number
  active: number
  noIdentifier: number
  duplicates: number
  updated: number
  processingTime: number
}

interface ErrorResponse {
  success: false
  error: string
}

/**
 * POST /api/audience/upload
 * Accepts multipart/form-data with CSV file and clientId
 * Processes records using existing deduplication logic
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<UploadResponse | ErrorResponse>> {
  // Check authentication
  const authResult = await requireAuth()
  if (!isSession(authResult)) {
    return authResult as NextResponse<ErrorResponse>
  }

  const startTime = Date.now()
  let logId: number | null = null
  let clientName = 'unknown'

  try {
    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const clientIdStr = formData.get('clientId') as string | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!clientIdStr) {
      return NextResponse.json(
        { success: false, error: 'Client ID is required' },
        { status: 400 }
      )
    }

    const clientId = parseInt(clientIdStr, 10)
    if (isNaN(clientId) || clientId < 1) {
      return NextResponse.json(
        { success: false, error: 'Invalid client ID' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { success: false, error: 'File must be a CSV' },
        { status: 400 }
      )
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'File size must be less than 10MB' },
        { status: 400 }
      )
    }

    // Validate client exists and is active
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, isActive: true },
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
      event: 'manual_upload_start',
      clientName: client.name,
      filename: file.name,
      timestamp: new Date().toISOString(),
    })

    // Create processing log entry
    const logEntry = await prisma.fileProcessingLog.create({
      data: {
        clientId,
        fileName: `MANUAL_UPLOAD: ${file.name}`,
        status: 'processing',
        recordsTotal: 0,
        recordsNew: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        recordsNoIdentifier: 0,
      },
    })
    logId = logEntry.id

    // Read and parse CSV content
    const csvContent = await file.text()
    let parsedRecords
    try {
      parsedRecords = parseCSV(csvContent)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'CSV parsing failed'

      await prisma.fileProcessingLog.update({
        where: { id: logId },
        data: {
          status: 'failed',
          errorMessage,
        },
      })

      safeLog({
        event: 'manual_upload_parse_failed',
        clientName: client.name,
        filename: file.name,
        status: 'error',
        timestamp: new Date().toISOString(),
      })

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 400 }
      )
    }

    if (parsedRecords.length === 0) {
      await prisma.fileProcessingLog.update({
        where: { id: logId },
        data: {
          status: 'completed',
          recordsTotal: 0,
        },
      })

      return NextResponse.json({
        success: true,
        total: 0,
        active: 0,
        noIdentifier: 0,
        duplicates: 0,
        updated: 0,
        processingTime: Date.now() - startTime,
      })
    }

    safeLog({
      event: 'manual_upload_processing',
      clientName: client.name,
      filename: file.name,
      recordsFound: parsedRecords.length,
      timestamp: new Date().toISOString(),
    })

    // Process records using existing deduplication logic
    let processingResult
    try {
      processingResult = await processRecords(
        parsedRecords,
        clientId,
        `MANUAL_UPLOAD: ${file.name}`
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed'

      await prisma.fileProcessingLog.update({
        where: { id: logId },
        data: {
          status: 'failed',
          errorMessage,
          recordsTotal: parsedRecords.length,
        },
      })

      safeLog({
        event: 'manual_upload_process_failed',
        clientName: client.name,
        filename: file.name,
        status: 'error',
        timestamp: new Date().toISOString(),
      })

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 500 }
      )
    }

    const processingTime = Date.now() - startTime

    // Update processing log
    await prisma.fileProcessingLog.update({
      where: { id: logId },
      data: {
        status: 'completed',
        recordsTotal: parsedRecords.length,
        recordsNew: processingResult.newRecords,
        recordsUpdated: processingResult.updated,
        recordsSkipped: processingResult.duplicates - processingResult.updated,
        recordsNoIdentifier: processingResult.noIdentifier,
        errorMessage: processingResult.errors.length > 0
          ? processingResult.errors.slice(0, 5).join('; ')
          : null,
      },
    })

    safeLog({
      event: 'manual_upload_complete',
      clientName: client.name,
      filename: file.name,
      recordsFound: parsedRecords.length,
      status: 'success',
      timestamp: new Date().toISOString(),
    })

    // Calculate active records (new + updated that have identifiers)
    const activeRecords = processingResult.newRecords + processingResult.updated - processingResult.noIdentifier

    return NextResponse.json({
      success: true,
      total: parsedRecords.length,
      active: activeRecords > 0 ? activeRecords : processingResult.newRecords,
      noIdentifier: processingResult.noIdentifier,
      duplicates: processingResult.duplicates,
      updated: processingResult.updated,
      processingTime,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Upload failed'

    // Update log if we have one
    if (logId) {
      await prisma.fileProcessingLog.update({
        where: { id: logId },
        data: {
          status: 'failed',
          errorMessage,
        },
      }).catch(() => {
        // Ignore errors updating the log
      })
    }

    safeLog({
      event: 'manual_upload_error',
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
