import crypto from 'crypto'
import { safeLog } from '@/lib/logger'

// Facebook Business SDK imports
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bizSdk = require('facebook-nodejs-business-sdk')
const AdAccount = bizSdk.AdAccount
const CustomAudience = bizSdk.CustomAudience
const FacebookAdsApi = bizSdk.FacebookAdsApi

export interface AudienceMember {
  email: string | null
  phone: string | null
  firstName: string
  lastName: string
}

export interface FormattedRecord {
  EMAIL?: string
  PHONE?: string
  FN?: string
  LN?: string
}

export interface UploadResult {
  success: boolean
  recordsUploaded: number
}

export interface AudienceStats {
  size: number
  status: string
}

const BATCH_SIZE = 1000
const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 1000

/**
 * Validates that Meta API credentials are configured
 */
function validateCredentials(): void {
  if (!process.env.META_ACCESS_TOKEN) {
    throw new Error('Meta API credentials not configured: META_ACCESS_TOKEN missing')
  }
  if (!process.env.META_AD_ACCOUNT_ID) {
    throw new Error('Meta API credentials not configured: META_AD_ACCOUNT_ID missing')
  }
}

/**
 * Initializes the Facebook Ads API with credentials
 */
function initializeApi(): void {
  validateCredentials()
  FacebookAdsApi.init(process.env.META_ACCESS_TOKEN)
}

/**
 * Hashes a value using SHA256
 * @param value - The value to hash
 * @returns Hex-encoded SHA256 hash
 */
export function hashValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

/**
 * Normalizes and hashes an email address
 * @param email - Raw email address
 * @returns Hashed normalized email
 */
function normalizeAndHashEmail(email: string): string {
  const normalized = email.toLowerCase().trim()
  return hashValue(normalized)
}

/**
 * Normalizes and hashes a phone number (digits only)
 * @param phone - Raw phone number
 * @returns Hashed normalized phone
 */
function normalizeAndHashPhone(phone: string): string {
  // Remove all non-digits and any leading country codes
  const digitsOnly = phone.replace(/\D/g, '')
  // Remove leading 1 for US numbers if present and length > 10
  const normalized = digitsOnly.length === 11 && digitsOnly.startsWith('1')
    ? digitsOnly.slice(1)
    : digitsOnly
  return hashValue(normalized)
}

/**
 * Normalizes and hashes a name field
 * @param name - Raw name
 * @returns Hashed normalized name
 */
function normalizeAndHashName(name: string): string {
  const normalized = name.toLowerCase().trim()
  return hashValue(normalized)
}

/**
 * Creates a new Custom Audience (Customer List) in Meta
 * @param name - Audience name
 * @param description - Audience description
 * @returns The created audience ID
 */
export async function createCustomerList(
  name: string,
  description: string
): Promise<string> {
  initializeApi()

  safeLog({
    event: 'meta_create_audience_start',
    status: 'processing',
    timestamp: new Date().toISOString(),
  })

  try {
    const adAccount = new AdAccount(process.env.META_AD_ACCOUNT_ID)

    const audience = await adAccount.createCustomAudience([], {
      name,
      description,
      subtype: 'CUSTOM',
      customer_file_source: 'USER_PROVIDED_ONLY',
    })

    const audienceId = audience.id

    safeLog({
      event: 'meta_create_audience_complete',
      status: 'success',
      timestamp: new Date().toISOString(),
    })

    return audienceId
  } catch (error) {
    const errorMessage = formatMetaError(error)

    safeLog({
      event: 'meta_create_audience_failed',
      status: 'error',
      timestamp: new Date().toISOString(),
    })

    throw new Error(`Failed to create Custom Audience: ${errorMessage}`)
  }
}

/**
 * Formats audience member data for Meta API upload
 * All values are normalized and hashed per Meta's requirements
 * @param members - Array of audience members
 * @returns Array of formatted records ready for upload
 */
export function formatAudienceData(members: AudienceMember[]): FormattedRecord[] {
  const formatted: FormattedRecord[] = []

  for (const member of members) {
    // Skip records missing BOTH email AND phone
    if (!member.email && !member.phone) {
      continue
    }

    const record: FormattedRecord = {}

    // Hash email if present
    if (member.email) {
      record.EMAIL = normalizeAndHashEmail(member.email)
    }

    // Hash phone if present
    if (member.phone) {
      record.PHONE = normalizeAndHashPhone(member.phone)
    }

    // Hash first name if present
    if (member.firstName) {
      record.FN = normalizeAndHashName(member.firstName)
    }

    // Hash last name if present
    if (member.lastName) {
      record.LN = normalizeAndHashName(member.lastName)
    }

    formatted.push(record)
  }

  safeLog({
    event: 'meta_format_data_complete',
    recordsFound: formatted.length,
    timestamp: new Date().toISOString(),
  })

  return formatted
}

/**
 * Uploads formatted data to a Custom Audience with batching and retry logic
 * @param audienceId - The Meta Custom Audience ID
 * @param data - Array of formatted and hashed records
 * @param clientName - Client name for logging
 * @returns Upload result with success status and count
 */
export async function uploadToCustomerList(
  audienceId: string,
  data: FormattedRecord[],
  clientName: string
): Promise<UploadResult> {
  initializeApi()

  if (data.length === 0) {
    return { success: true, recordsUploaded: 0 }
  }

  safeLog({
    event: 'meta_upload_start',
    clientName,
    recordsFound: data.length,
    timestamp: new Date().toISOString(),
  })

  // Split data into batches
  const batches: FormattedRecord[][] = []
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    batches.push(data.slice(i, i + BATCH_SIZE))
  }

  let totalUploaded = 0

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex]
    const batchNumber = batchIndex + 1
    const totalBatches = batches.length

    safeLog({
      event: 'meta_upload_batch_start',
      clientName,
      status: `batch ${batchNumber}/${totalBatches}`,
      recordsFound: batch.length,
      timestamp: new Date().toISOString(),
    })

    // Retry logic with exponential backoff
    let lastError: Error | null = null
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await uploadBatch(audienceId, batch)
        totalUploaded += batch.length

        safeLog({
          event: 'meta_upload_batch_complete',
          clientName,
          status: `batch ${batchNumber}/${totalBatches}`,
          recordsFound: batch.length,
          timestamp: new Date().toISOString(),
        })

        lastError = null
        break
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')

        // Check if it's a rate limit error
        const isRateLimit = isRateLimitError(error)

        if (attempt < MAX_RETRIES && isRateLimit) {
          const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1)

          safeLog({
            event: 'meta_upload_retry',
            clientName,
            status: `attempt ${attempt}/${MAX_RETRIES}`,
            timestamp: new Date().toISOString(),
          })

          await sleep(backoffMs)
        } else if (!isRateLimit) {
          // Non-rate-limit error, don't retry
          break
        }
      }
    }

    if (lastError) {
      const errorMessage = formatMetaError(lastError)

      safeLog({
        event: 'meta_upload_batch_failed',
        clientName,
        status: 'error',
        timestamp: new Date().toISOString(),
      })

      throw new Error(`Failed to upload batch ${batchNumber}: ${errorMessage}`)
    }
  }

  safeLog({
    event: 'meta_upload_complete',
    clientName,
    recordsFound: totalUploaded,
    status: 'success',
    timestamp: new Date().toISOString(),
  })

  return {
    success: true,
    recordsUploaded: totalUploaded,
  }
}

/**
 * Uploads a single batch to Meta
 */
async function uploadBatch(audienceId: string, batch: FormattedRecord[]): Promise<void> {
  const audience = new CustomAudience(audienceId)

  // Format data for Meta API
  const schema = ['EMAIL', 'PHONE', 'FN', 'LN']
  const userData = batch.map((record) => [
    record.EMAIL || '',
    record.PHONE || '',
    record.FN || '',
    record.LN || '',
  ])

  await audience.createUser([], {
    payload: {
      schema,
      data: userData,
    },
  })
}

/**
 * Gets statistics for a Custom Audience
 * @param audienceId - The Meta Custom Audience ID
 * @returns Audience size and status
 */
export async function getCustomerListStats(audienceId: string): Promise<AudienceStats> {
  initializeApi()

  try {
    const audience = new CustomAudience(audienceId)
    const result = await audience.get([
      'approximate_count',
      'operation_status',
    ])

    return {
      size: result.approximate_count || 0,
      status: result.operation_status?.code?.toString() || 'unknown',
    }
  } catch (error) {
    const errorMessage = formatMetaError(error)

    if (errorMessage.includes('does not exist') || errorMessage.includes('not found')) {
      throw new Error('Audience not found')
    }

    throw new Error(`Failed to get audience stats: ${errorMessage}`)
  }
}

/**
 * Removes users from a Custom Audience
 * @param audienceId - The Meta Custom Audience ID
 * @param data - Array of formatted and hashed records to remove
 * @param clientName - Client name for logging
 * @returns Result with count removed
 */
export async function removeFromCustomerList(
  audienceId: string,
  data: FormattedRecord[],
  clientName: string
): Promise<UploadResult> {
  initializeApi()

  if (data.length === 0) {
    return { success: true, recordsUploaded: 0 }
  }

  safeLog({
    event: 'meta_remove_start',
    clientName,
    recordsFound: data.length,
    timestamp: new Date().toISOString(),
  })

  try {
    const audience = new CustomAudience(audienceId)

    // Format data for Meta API
    const schema = ['EMAIL', 'PHONE', 'FN', 'LN']
    const userData = data.map((record) => [
      record.EMAIL || '',
      record.PHONE || '',
      record.FN || '',
      record.LN || '',
    ])

    await audience.deleteUsers({
      payload: {
        schema,
        data: userData,
      },
    })

    safeLog({
      event: 'meta_remove_complete',
      clientName,
      recordsFound: data.length,
      status: 'success',
      timestamp: new Date().toISOString(),
    })

    return {
      success: true,
      recordsUploaded: data.length,
    }
  } catch (error) {
    const errorMessage = formatMetaError(error)

    safeLog({
      event: 'meta_remove_failed',
      clientName,
      status: 'error',
      timestamp: new Date().toISOString(),
    })

    throw new Error(`Failed to remove users: ${errorMessage}`)
  }
}

/**
 * Formats Meta API errors for consistent messaging
 * Enhanced to capture full error details from Facebook SDK
 */
function formatMetaError(error: unknown): string {
  // Log the full error structure for debugging
  try {
    console.error('Meta API Error (full):', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
  } catch {
    console.error('Meta API Error (non-serializable):', error)
  }

  if (error && typeof error === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fbError = error as any

    // Facebook SDK error structure: error._error.error_user_msg
    if (fbError._error?.error_user_msg) {
      return `[${fbError._error.code || 'UNKNOWN'}] ${fbError._error.error_user_msg}`
    }

    // Alternative SDK structure: error._error.message
    if (fbError._error?.message) {
      return `[${fbError._error.code || 'UNKNOWN'}] ${fbError._error.message}`
    }

    // Response error structure: error.response.error.message
    if (fbError.response?.error?.message) {
      return `[${fbError.response.error.code || 'UNKNOWN'}] ${fbError.response.error.message}`
    }

    // Body error structure: error.body.error.message
    if (fbError.body?.error?.message) {
      return `[${fbError.body.error.code || 'UNKNOWN'}] ${fbError.body.error.message}`
    }

    // Direct error properties
    if (fbError.error_user_msg) {
      return `[${fbError.code || 'UNKNOWN'}] ${fbError.error_user_msg}`
    }

    // Standard Error with message
    if (fbError.message) {
      return fbError.message
    }
  }

  return 'Unknown Meta API error'
}

/**
 * Checks if an error is a rate limit error
 */
function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    const metaError = error as { code?: number }
    return (
      message.includes('rate limit') ||
      message.includes('too many calls') ||
      metaError.code === 17 ||
      metaError.code === 4
    )
  }
  return false
}

/**
 * Sleep helper for backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
