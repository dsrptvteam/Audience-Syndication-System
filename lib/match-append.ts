import { prisma } from '@/lib/db'
import { safeLog } from '@/lib/logger'
import type { ParsedRecord } from '@/lib/csv-parser'
import { AUDIENCE_STATUS } from '@/lib/deduplication'

export type MatchAction = 'created' | 'updated' | 'skipped'
export type MatchStrategy = 'email+name' | 'phone+name' | 'email' | 'phone' | 'none'

export interface ProcessRecordResult {
  action: MatchAction
  recordId: number
  matchedBy?: MatchStrategy
  fieldsUpdated?: string[]
}

export interface BatchProcessResult {
  created: number
  updated: number
  skipped: number
  noIdentifier: number
  results: ProcessRecordResult[]
  errors: string[]
}

export interface MatchAppendOptions {
  mode: 'append' | 'update'
  clientId: number
  sourceFile?: string
}

const DAYS_REMAINING_DEFAULT = 30

/**
 * Finds a matching record using progressive matching strategies
 * @returns Matching record or null if no match found
 */
async function findMatchingRecord(
  record: ParsedRecord,
  clientId: number
): Promise<{ record: any; matchedBy: MatchStrategy } | null> {
  // STRATEGY 1: Email + Name match (strongest)
  if (record.email && record.firstName && record.lastName) {
    const match = await prisma.audienceMember.findFirst({
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
    })

    if (match) {
      return { record: match, matchedBy: 'email+name' }
    }
  }

  // STRATEGY 2: Phone + Name match
  if (record.phone && record.firstName && record.lastName) {
    const match = await prisma.audienceMember.findFirst({
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
    })

    if (match) {
      return { record: match, matchedBy: 'phone+name' }
    }
  }

  // STRATEGY 3: Email only match
  if (record.email) {
    const match = await prisma.audienceMember.findFirst({
      where: {
        clientId,
        email: {
          equals: record.email,
          mode: 'insensitive',
        },
      },
    })

    if (match) {
      return { record: match, matchedBy: 'email' }
    }
  }

  // STRATEGY 4: Phone only match
  if (record.phone) {
    const match = await prisma.audienceMember.findFirst({
      where: {
        clientId,
        phone: {
          equals: record.phone,
        },
      },
    })

    if (match) {
      return { record: match, matchedBy: 'phone' }
    }
  }

  return null
}

/**
 * Determines the status for an audience member based on identifiers
 */
function getRecordStatus(email: string | null, phone: string | null): string {
  const hasEmail = email && email.trim().length > 0
  const hasPhone = phone && phone.trim().length > 0
  return hasEmail || hasPhone ? AUDIENCE_STATUS.ACTIVE : AUDIENCE_STATUS.NO_IDENTIFIER
}

/**
 * Processes a single record with match-append logic
 */
export async function processRecordWithMatch(
  record: ParsedRecord,
  options: MatchAppendOptions
): Promise<ProcessRecordResult> {
  const { mode, clientId, sourceFile } = options
  const today = new Date()
  const status = getRecordStatus(record.email, record.phone)

  // Try to find matching record
  const matchResult = await findMatchingRecord(record, clientId)

  if (!matchResult) {
    // No match found - create new record
    const newRecord = await prisma.audienceMember.create({
      data: {
        clientId,
        firstName: record.firstName,
        lastName: record.lastName,
        email: record.email,
        phone: record.phone,
        dateAdded: today,
        daysRemaining: DAYS_REMAINING_DEFAULT,
        status,
        sourceFile: sourceFile || null,
      },
    })

    return {
      action: 'created',
      recordId: newRecord.id,
    }
  }

  // Match found
  if (mode === 'append') {
    // Append mode: skip existing records
    return {
      action: 'skipped',
      recordId: matchResult.record.id,
      matchedBy: matchResult.matchedBy,
    }
  }

  // Update mode: update existing record
  const fieldsUpdated: string[] = []
  const updateData: any = {
    updatedAt: today,
  }

  // Check each field for changes
  if (record.email && record.email !== matchResult.record.email) {
    updateData.email = record.email
    fieldsUpdated.push('email')
  }

  if (record.phone && record.phone !== matchResult.record.phone) {
    updateData.phone = record.phone
    fieldsUpdated.push('phone')
  }

  if (record.firstName && record.firstName !== matchResult.record.firstName) {
    updateData.firstName = record.firstName
    fieldsUpdated.push('firstName')
  }

  if (record.lastName && record.lastName !== matchResult.record.lastName) {
    updateData.lastName = record.lastName
    fieldsUpdated.push('lastName')
  }

  // If identifiers were added, change status to ACTIVE and reset retention timer
  const hadIdentifier = matchResult.record.email || matchResult.record.phone
  const hasIdentifierNow = record.email || record.phone

  if (!hadIdentifier && hasIdentifierNow) {
    updateData.status = AUDIENCE_STATUS.ACTIVE
    updateData.daysRemaining = DAYS_REMAINING_DEFAULT
    updateData.dateAdded = today
    fieldsUpdated.push('status')
  }

  // Only update if there are changes
  if (fieldsUpdated.length > 0) {
    await prisma.audienceMember.update({
      where: { id: matchResult.record.id },
      data: updateData,
    })

    return {
      action: 'updated',
      recordId: matchResult.record.id,
      matchedBy: matchResult.matchedBy,
      fieldsUpdated,
    }
  }

  // No changes needed
  return {
    action: 'skipped',
    recordId: matchResult.record.id,
    matchedBy: matchResult.matchedBy,
    fieldsUpdated: [],
  }
}

/**
 * Processes multiple records with match-append logic
 */
export async function batchProcessWithMatch(
  records: ParsedRecord[],
  options: MatchAppendOptions
): Promise<BatchProcessResult> {
  const result: BatchProcessResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    noIdentifier: 0,
    results: [],
    errors: [],
  }

  if (!records || records.length === 0) {
    safeLog({
      event: 'match_append_empty',
      clientName: `client_${options.clientId}`,
      status: 'warning',
      timestamp: new Date().toISOString(),
    })
    return result
  }

  // Process each record
  for (let i = 0; i < records.length; i++) {
    const record = records[i]

    try {
      const processResult = await processRecordWithMatch(record, options)
      result.results.push(processResult)

      // Update counters
      if (processResult.action === 'created') {
        result.created++
      } else if (processResult.action === 'updated') {
        result.updated++
      } else if (processResult.action === 'skipped') {
        result.skipped++
      }

      // Count NO_IDENTIFIER records
      const status = getRecordStatus(record.email, record.phone)
      if (status === AUDIENCE_STATUS.NO_IDENTIFIER) {
        result.noIdentifier++
      }

      // Log match found
      if (processResult.matchedBy) {
        safeLog({
          event: 'match_append_match',
          clientName: `client_${options.clientId}`,
          status: processResult.matchedBy,
          recordsFound: processResult.action === 'updated' ? 1 : 0,
          timestamp: new Date().toISOString(),
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`Row ${i + 1}: ${errorMessage}`)
    }
  }

  // Log summary
  safeLog({
    event: 'match_append_complete',
    clientName: `client_${options.clientId}`,
    mode: options.mode,
    recordsFound: records.length,
    status: 'success',
    timestamp: new Date().toISOString(),
  })

  return result
}
