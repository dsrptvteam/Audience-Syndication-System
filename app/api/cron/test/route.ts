import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { prisma } from '@/lib/db'
import { downloadLatestCSV } from '@/lib/sftp-helper'
import { parseCSV } from '@/lib/csv-parser'
import { processRecords } from '@/lib/deduplication'
import { formatAudienceData, uploadToCustomerList } from '@/lib/meta-api'
import { safeLog } from '@/lib/logger'
import { requireAuth, isSession } from '@/lib/auth-helper'
import {
  getDailySummaryEmail,
  getDailySummaryText,
  type ClientResult,
  type DailySummaryData,
} from '@/lib/email-templates'

const resend = new Resend(process.env.RESEND_API_KEY)

interface TestCronResponse {
  success: boolean
  date: string
  expiredMembers: number
  clientsProcessed: number
  totalRecordsAdded: number
  totalRecordsSynced: number
  errors: string[]
  details: {
    clientResults: ClientResult[]
    processingTimeMs: number
    emailSent: boolean
    emailRecipients: number
  }
}

/**
 * GET /api/cron/test
 * Test endpoint for daily cron - protected by session auth (not cron secret)
 * Returns detailed response for debugging
 */
export async function GET(): Promise<NextResponse<TestCronResponse | { error: string }>> {
  // Use session auth instead of cron secret
  const authResult = await requireAuth()
  if (!isSession(authResult)) {
    return authResult as NextResponse<{ error: string }>
  }

  const startTime = Date.now()
  const today = new Date()
  const dateString = today.toISOString().split('T')[0]

  const errors: string[] = []
  const clientResults: ClientResult[] = []
  let expiredMembers = 0
  let totalRecordsAdded = 0
  let totalRecordsSynced = 0
  let emailSent = false
  let emailRecipients = 0

  safeLog({
    event: 'cron_test_start',
    timestamp: new Date().toISOString(),
  })

  try {
    // Step 1: Decrement daysRemaining for all active audience members
    safeLog({
      event: 'cron_test_decrement_start',
      timestamp: new Date().toISOString(),
    })

    await prisma.audienceMember.updateMany({
      where: {
        daysRemaining: {
          gt: 0,
        },
      },
      data: {
        daysRemaining: {
          decrement: 1,
        },
      },
    })

    // Step 2: Delete expired members (daysRemaining = 0)
    const expiredResult = await prisma.audienceMember.deleteMany({
      where: {
        daysRemaining: {
          lte: 0,
        },
      },
    })
    expiredMembers = expiredResult.count

    safeLog({
      event: 'cron_test_expired_removed',
      recordsFound: expiredMembers,
      timestamp: new Date().toISOString(),
    })

    // Step 3: Get all active clients
    const activeClients = await prisma.client.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        metaAudienceId: true,
      },
    })

    safeLog({
      event: 'cron_test_clients_found',
      recordsFound: activeClients.length,
      timestamp: new Date().toISOString(),
    })

    // Step 4: Process each active client
    for (const client of activeClients) {
      const clientResult: ClientResult = {
        clientName: client.name,
        recordsAdded: 0,
        recordsSynced: 0,
        status: 'success',
      }

      try {
        safeLog({
          event: 'cron_test_client_start',
          clientName: client.name,
          timestamp: new Date().toISOString(),
        })

        // Download and process CSV
        let recordsAdded = 0
        try {
          const { filename, content } = await downloadLatestCSV(client.id.toString())
          const parsedRecords = parseCSV(content)
          const processResult = await processRecords(parsedRecords, client.id, filename)

          recordsAdded = processResult.newRecords
          clientResult.recordsAdded = recordsAdded
          totalRecordsAdded += recordsAdded

          // Log file processing
          await prisma.fileProcessingLog.create({
            data: {
              clientId: client.id,
              fileName: filename,
              status: 'completed',
              recordsTotal: parsedRecords.length,
              recordsNew: processResult.newRecords,
              recordsUpdated: processResult.updated,
              recordsSkipped: processResult.duplicates - processResult.updated,
            },
          })

          safeLog({
            event: 'cron_test_client_processed',
            clientName: client.name,
            filename,
            recordsFound: recordsAdded,
            timestamp: new Date().toISOString(),
          })
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          safeLog({
            event: 'cron_test_client_sftp_failed',
            clientName: client.name,
            status: 'error',
            timestamp: new Date().toISOString(),
          })
          errors.push(`${client.name} SFTP: ${errorMsg}`)
        }

        // Sync to Meta (if client has audienceId)
        if (client.metaAudienceId) {
          try {
            const audienceMembers = await prisma.audienceMember.findMany({
              where: {
                clientId: client.id,
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

            if (audienceMembers.length > 0) {
              const formattedData = formatAudienceData(
                audienceMembers.map((m: (typeof audienceMembers)[number]) => ({
                  email: m.email,
                  phone: m.phone,
                  firstName: m.firstName || '',
                  lastName: m.lastName || '',
                }))
              )

              const uploadResult = await uploadToCustomerList(
                client.metaAudienceId,
                formattedData,
                client.name
              )

              clientResult.recordsSynced = uploadResult.recordsUploaded
              totalRecordsSynced += uploadResult.recordsUploaded

              // Log meta sync
              await prisma.metaSyncLog.create({
                data: {
                  clientId: client.id,
                  audienceId: client.metaAudienceId,
                  syncType: 'add',
                  status: 'completed',
                  recordsTotal: formattedData.length,
                  recordsSuccess: uploadResult.recordsUploaded,
                  recordsFailed: 0,
                },
              })

              safeLog({
                event: 'cron_test_client_synced',
                clientName: client.name,
                recordsFound: uploadResult.recordsUploaded,
                timestamp: new Date().toISOString(),
              })
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'
            safeLog({
              event: 'cron_test_client_meta_failed',
              clientName: client.name,
              status: 'error',
              timestamp: new Date().toISOString(),
            })
            errors.push(`${client.name} Meta sync: ${errorMsg}`)
            clientResult.status = 'failed'
            clientResult.error = errorMsg
          }
        } else {
          safeLog({
            event: 'cron_test_client_no_audience',
            clientName: client.name,
            timestamp: new Date().toISOString(),
          })
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        clientResult.status = 'failed'
        clientResult.error = errorMsg
        errors.push(`${client.name}: ${errorMsg}`)

        safeLog({
          event: 'cron_test_client_failed',
          clientName: client.name,
          status: 'error',
          timestamp: new Date().toISOString(),
        })
      }

      clientResults.push(clientResult)
    }

    // Step 5: Send summary email
    const summaryData: DailySummaryData = {
      date: dateString,
      expiredMembers,
      clientsProcessed: activeClients.length,
      totalRecordsAdded,
      totalRecordsSynced,
      clientResults,
      errors,
    }

    try {
      const alertRecipients = await prisma.alertRecipient.findMany({
        where: { isActive: true },
        select: { email: true },
      })

      emailRecipients = alertRecipients.length

      if (alertRecipients.length > 0) {
        await resend.emails.send({
          from: process.env.EMAIL_FROM || 'noreply@example.com',
          to: alertRecipients.map((r: (typeof alertRecipients)[number]) => r.email),
          subject: `[TEST] Daily Audience Sync Report - ${dateString}`,
          html: getDailySummaryEmail(summaryData),
          text: getDailySummaryText(summaryData),
        })

        emailSent = true

        safeLog({
          event: 'cron_test_email_sent',
          recordsFound: alertRecipients.length,
          timestamp: new Date().toISOString(),
        })
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Email notification: ${errorMsg}`)

      safeLog({
        event: 'cron_test_email_failed',
        status: 'error',
        timestamp: new Date().toISOString(),
      })
    }

    const processingTime = Date.now() - startTime

    safeLog({
      event: 'cron_test_complete',
      recordsFound: totalRecordsAdded,
      status: 'success',
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      date: dateString,
      expiredMembers,
      clientsProcessed: activeClients.length,
      totalRecordsAdded,
      totalRecordsSynced,
      errors,
      details: {
        clientResults,
        processingTimeMs: processingTime,
        emailSent,
        emailRecipients,
      },
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Cron test failed'

    safeLog({
      event: 'cron_test_failed',
      status: 'error',
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    )
  }
}
