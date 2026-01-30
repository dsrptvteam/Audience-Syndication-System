import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth, isSession } from '@/lib/auth-helper'
import { downloadLatestCSV } from '@/lib/sftp-helper'
import { parseCSV } from '@/lib/csv-parser'
import { processRecords } from '@/lib/deduplication'
import { safeLog } from '@/lib/logger'

// Request body validation schema
const processRequestSchema = z.object({
  clientId: z.number().int().positive('Client ID must be a positive integer'),
})

interface ProcessResponse {
  success: boolean
  fileName: string
  recordsProcessed: number
  newRecords: number
  duplicates: number
  updated: number
  processingTime: number
}

interface ErrorResponse {
  success: false
  error: string
}

/**
 * POST /api/process
 * Triggers SFTP file download, parsing, and deduplication for a client
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ProcessResponse | ErrorResponse>> {
  // Check authentication
  const authResult = await requireAuth()
  if (!isSession(authResult)) {
    return authResult as NextResponse<ErrorResponse>
  }

  const startTime = Date.now()
  let logId: number | null = null
  let clientName = 'unknown'

  try {
    // Parse and validate request body
    const body = await request.json()
    const validationResult = processRequestSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: validationResult.error.issues[0].message },
        { status: 400 }
      )
    }

    const { clientId } = validationResult.data

    // Step 1: Validate clientId exists and client is active
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
      event: 'process_start',
      clientName: client.name,
      timestamp: new Date().toISOString(),
    })

    // Step 2: Download CSV from SFTP
    let fileName: string
    let csvContent: string

    try {
      const downloadResult = await downloadLatestCSV(clientId.toString())
      fileName = downloadResult.filename
      csvContent = downloadResult.content
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'SFTP download failed'

      // Log failed processing attempt
      await prisma.fileProcessingLog.create({
        data: {
          clientId,
          fileName: 'unknown',
          status: 'failed',
          errorMessage: errorMessage,
          recordsTotal: 0,
          recordsNew: 0,
          recordsUpdated: 0,
          recordsSkipped: 0,
        },
      })

      safeLog({
        event: 'process_sftp_failed',
        clientName: client.name,
        status: 'error',
        timestamp: new Date().toISOString(),
      })

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 500 }
      )
    }

    // Step 3: Create file_processing_log entry (status: 'processing')
    const logEntry = await prisma.fileProcessingLog.create({
      data: {
        clientId,
        fileName,
        status: 'processing',
        recordsTotal: 0,
        recordsNew: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
      },
    })
    logId = logEntry.id

    safeLog({
      event: 'process_parsing',
      clientName: client.name,
      filename: fileName,
      timestamp: new Date().toISOString(),
    })

    // Step 4: Parse CSV content
    let parsedRecords
    try {
      parsedRecords = parseCSV(csvContent)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'CSV parsing failed'

      await prisma.fileProcessingLog.update({
        where: { id: logId },
        data: {
          status: 'failed',
          errorMessage: errorMessage,
        },
      })

      safeLog({
        event: 'process_parse_failed',
        clientName: client.name,
        filename: fileName,
        status: 'error',
        timestamp: new Date().toISOString(),
      })

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 400 }
      )
    }

    safeLog({
      event: 'process_deduplicating',
      clientName: client.name,
      filename: fileName,
      recordsFound: parsedRecords.length,
      timestamp: new Date().toISOString(),
    })

    // Step 5: Process records (deduplication)
    let processingResult
    try {
      processingResult = await processRecords(parsedRecords, clientId, fileName)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Deduplication failed'

      await prisma.fileProcessingLog.update({
        where: { id: logId },
        data: {
          status: 'failed',
          errorMessage: errorMessage,
          recordsTotal: parsedRecords.length,
        },
      })

      safeLog({
        event: 'process_dedup_failed',
        clientName: client.name,
        filename: fileName,
        status: 'error',
        timestamp: new Date().toISOString(),
      })

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 500 }
      )
    }

    const processingTime = Date.now() - startTime

    // Step 6: Update file_processing_log entry (status: 'completed')
    await prisma.fileProcessingLog.update({
      where: { id: logId },
      data: {
        status: 'completed',
        recordsTotal: parsedRecords.length,
        recordsNew: processingResult.newRecords,
        recordsUpdated: processingResult.updated,
        recordsSkipped: processingResult.duplicates - processingResult.updated,
        errorMessage: processingResult.errors.length > 0
          ? processingResult.errors.join('; ')
          : null,
      },
    })

    safeLog({
      event: 'process_complete',
      clientName: client.name,
      filename: fileName,
      recordsFound: parsedRecords.length,
      status: 'success',
      timestamp: new Date().toISOString(),
    })

    // Step 7: Return summary
    return NextResponse.json({
      success: true,
      fileName,
      recordsProcessed: parsedRecords.length,
      newRecords: processingResult.newRecords,
      duplicates: processingResult.duplicates,
      updated: processingResult.updated,
      processingTime,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Processing failed'

    // Update log if we have one
    if (logId) {
      await prisma.fileProcessingLog.update({
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
      event: 'process_error',
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
