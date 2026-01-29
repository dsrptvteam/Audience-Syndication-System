import { prisma } from '@/lib/db'
import { safeLog } from '@/lib/logger'
import type { ParsedRecord } from '@/lib/csv-parser'

export interface DeduplicationResult {
  isNew: boolean
  audienceMemberId: number | null
  matchedOn: string | null
}

export interface ProcessingResult {
  newRecords: number
  duplicates: number
  updated: number
  errors: string[]
}

const DAYS_REMAINING_DEFAULT = 30
const BATCH_SIZE = 100

/**
 * Deduplicates a single record using progressive matching strategy
 * @param record - The parsed CSV record to check
 * @param clientId - The client ID to scope the search
 * @returns Deduplication result with match info
 */
export async function deduplicateRecord(
  record: ParsedRecord,
  clientId: number
): Promise<DeduplicationResult> {
  // STEP 1: Email + Name Match
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
      select: {
        id: true,
      },
    })

    if (emailMatch) {
      return {
        isNew: false,
        audienceMemberId: emailMatch.id,
        matchedOn: 'email+name',
      }
    }
  }

  // STEP 2: Phone + Name Match
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
      select: {
        id: true,
      },
    })

    if (phoneMatch) {
      return {
        isNew: false,
        audienceMemberId: phoneMatch.id,
        matchedOn: 'phone+name',
      }
    }
  }

  // STEP 3: No match found - new user
  return {
    isNew: true,
    audienceMemberId: null,
    matchedOn: null,
  }
}

/**
 * Processes an array of records, inserting new ones and updating duplicates
 * @param records - Array of parsed CSV records
 * @param clientId - The client ID for these records
 * @param sourceFile - Optional source filename for tracking
 * @returns Processing summary with counts and errors
 */
export async function processRecords(
  records: ParsedRecord[],
  clientId: number,
  sourceFile?: string
): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    newRecords: 0,
    duplicates: 0,
    updated: 0,
    errors: [],
  }

  // Handle empty records array
  if (!records || records.length === 0) {
    safeLog({
      event: 'dedup_empty_records',
      clientName: `client_${clientId}`,
      status: 'warning',
      timestamp: new Date().toISOString(),
    })
    return result
  }

  // Validate clientId exists
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true },
  })

  if (!client) {
    throw new Error(`Invalid clientId: ${clientId} does not exist`)
  }

  const today = new Date()

  // Process in batches for large datasets
  const useBatching = records.length > BATCH_SIZE

  if (useBatching) {
    // Process with transactions for large batches
    await processBatchedRecords(records, clientId, client.name, sourceFile, today, result)
  } else {
    // Process individually for smaller datasets
    await processIndividualRecords(records, clientId, client.name, sourceFile, today, result)
  }

  // Log final summary
  safeLog({
    event: 'dedup_complete',
    clientName: client.name,
    recordsFound: records.length,
    status: 'success',
    timestamp: new Date().toISOString(),
  })

  return result
}

/**
 * Process records individually (for smaller datasets)
 */
async function processIndividualRecords(
  records: ParsedRecord[],
  clientId: number,
  clientName: string,
  sourceFile: string | undefined,
  today: Date,
  result: ProcessingResult
): Promise<void> {
  for (let i = 0; i < records.length; i++) {
    const record = records[i]

    try {
      const dedupResult = await deduplicateRecord(record, clientId)

      if (dedupResult.isNew) {
        // Insert new record
        await prisma.audienceMember.create({
          data: {
            clientId,
            firstName: record.firstName,
            lastName: record.lastName,
            email: record.email,
            phone: record.phone,
            dateAdded: today,
            daysRemaining: DAYS_REMAINING_DEFAULT,
            sourceFile: sourceFile || null,
          },
        })
        result.newRecords++
      } else {
        // Update existing record
        await prisma.audienceMember.update({
          where: { id: dedupResult.audienceMemberId! },
          data: {
            daysRemaining: DAYS_REMAINING_DEFAULT,
            email: record.email,
            phone: record.phone,
            firstName: record.firstName,
            lastName: record.lastName,
            updatedAt: today,
          },
        })
        result.updated++
        result.duplicates++

        safeLog({
          event: 'dedup_match_found',
          clientName,
          status: dedupResult.matchedOn || 'unknown',
          timestamp: new Date().toISOString(),
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`Row ${i + 1}: ${errorMessage}`)
    }
  }
}

/**
 * Process records in batches with transactions (for larger datasets)
 */
async function processBatchedRecords(
  records: ParsedRecord[],
  clientId: number,
  clientName: string,
  sourceFile: string | undefined,
  today: Date,
  result: ProcessingResult
): Promise<void> {
  // First, deduplicate all records to categorize them
  const newRecords: ParsedRecord[] = []
  const updateRecords: Array<{ record: ParsedRecord; audienceMemberId: number; matchedOn: string }> = []

  for (let i = 0; i < records.length; i++) {
    const record = records[i]

    try {
      const dedupResult = await deduplicateRecord(record, clientId)

      if (dedupResult.isNew) {
        newRecords.push(record)
      } else {
        updateRecords.push({
          record,
          audienceMemberId: dedupResult.audienceMemberId!,
          matchedOn: dedupResult.matchedOn || 'unknown',
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`Row ${i + 1} dedup: ${errorMessage}`)
    }
  }

  // Batch insert new records
  if (newRecords.length > 0) {
    try {
      await prisma.audienceMember.createMany({
        data: newRecords.map((record) => ({
          clientId,
          firstName: record.firstName,
          lastName: record.lastName,
          email: record.email,
          phone: record.phone,
          dateAdded: today,
          daysRemaining: DAYS_REMAINING_DEFAULT,
          sourceFile: sourceFile || null,
        })),
        skipDuplicates: true,
      })
      result.newRecords = newRecords.length
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`Batch insert failed: ${errorMessage}`)
    }
  }

  // Process updates in transaction batches
  for (let i = 0; i < updateRecords.length; i += BATCH_SIZE) {
    const batch = updateRecords.slice(i, i + BATCH_SIZE)

    try {
      await prisma.$transaction(
        batch.map(({ record, audienceMemberId }) =>
          prisma.audienceMember.update({
            where: { id: audienceMemberId },
            data: {
              daysRemaining: DAYS_REMAINING_DEFAULT,
              email: record.email,
              phone: record.phone,
              firstName: record.firstName,
              lastName: record.lastName,
              updatedAt: today,
            },
          })
        )
      )

      result.updated += batch.length
      result.duplicates += batch.length

      // Log match types for this batch
      const matchTypes = batch.reduce(
        (acc, { matchedOn }) => {
          acc[matchedOn] = (acc[matchedOn] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )

      for (const [matchType, count] of Object.entries(matchTypes)) {
        safeLog({
          event: 'dedup_batch_matches',
          clientName,
          status: matchType,
          recordsFound: count,
          timestamp: new Date().toISOString(),
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`Batch update ${i / BATCH_SIZE + 1} failed: ${errorMessage}`)
    }
  }
}

/**
 * Checks if a specific record already exists (for single record checks)
 * @param email - Email to check
 * @param phone - Phone to check
 * @param firstName - First name to match
 * @param lastName - Last name to match
 * @param clientId - Client ID to scope search
 * @returns True if record exists
 */
export async function recordExists(
  email: string | null,
  phone: string | null,
  firstName: string,
  lastName: string,
  clientId: number
): Promise<boolean> {
  const result = await deduplicateRecord(
    { email, phone, firstName, lastName },
    clientId
  )
  return !result.isNew
}
