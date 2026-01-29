import Papa from 'papaparse'
import { safeLog } from '@/lib/logger'

export interface ParsedRecord {
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
}

interface HeaderMapping {
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
}

// Flexible header mappings (case-insensitive)
const HEADER_MAPPINGS: Record<keyof HeaderMapping, string[]> = {
  firstName: ['first_name', 'firstname', 'first name', 'fname', 'first'],
  lastName: ['last_name', 'lastname', 'last name', 'lname', 'last'],
  email: ['email', 'email_address', 'e-mail', 'emailaddress'],
  phone: ['phone', 'phone_number', 'mobile', 'cell', 'telephone', 'tel', 'phonenumber'],
}

// Basic email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Normalizes a phone number by removing all non-digit characters
 * @param phone - Raw phone string
 * @returns Phone with only digits (0-9)
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

/**
 * Normalizes an email by trimming whitespace and converting to lowercase
 * @param email - Raw email string
 * @returns Lowercase trimmed email
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Validates email format using basic regex
 * @param email - Email to validate
 * @returns True if valid format
 */
function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email)
}

/**
 * Detects which CSV headers map to our standard fields
 * @param headers - Array of header names from CSV
 * @returns Mapping of our fields to CSV column names
 */
function detectHeaders(headers: string[]): HeaderMapping {
  const mapping: HeaderMapping = {
    firstName: null,
    lastName: null,
    email: null,
    phone: null,
  }

  const normalizedHeaders = headers.map((h) => h.toLowerCase().trim())

  for (const [field, possibleNames] of Object.entries(HEADER_MAPPINGS)) {
    const matchIndex = normalizedHeaders.findIndex((h) =>
      possibleNames.includes(h)
    )
    if (matchIndex !== -1) {
      mapping[field as keyof HeaderMapping] = headers[matchIndex]
    }
  }

  return mapping
}

/**
 * Parses CSV content with flexible header mapping
 * @param csvContent - Raw CSV string content
 * @returns Array of parsed and normalized records
 */
export function parseCSV(csvContent: string): ParsedRecord[] {
  // Check for empty content
  if (!csvContent || csvContent.trim().length === 0) {
    throw new Error('CSV file is empty')
  }

  // Parse CSV using papaparse
  const parseResult = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  })

  // Check for parse errors
  if (parseResult.errors.length > 0) {
    const firstError = parseResult.errors[0]
    throw new Error(
      `CSV parse error at line ${firstError.row !== undefined ? firstError.row + 2 : 'unknown'}: ${firstError.message}`
    )
  }

  // Check if we have any data
  if (!parseResult.data || parseResult.data.length === 0) {
    throw new Error('CSV file is empty')
  }

  // Get headers from parsed result
  const headers = parseResult.meta.fields || []
  if (headers.length === 0) {
    throw new Error('Invalid CSV format: No headers found')
  }

  // Detect header mappings
  const headerMapping = detectHeaders(headers)

  // Check if we have at least firstName or lastName mapping
  if (!headerMapping.firstName && !headerMapping.lastName) {
    throw new Error(
      'Invalid CSV format: Could not find name columns. ' +
      'Expected headers like "first_name", "firstname", "last_name", "lastname"'
    )
  }

  const records: ParsedRecord[] = []
  let skippedCount = 0
  let invalidEmailCount = 0

  for (let i = 0; i < parseResult.data.length; i++) {
    const row = parseResult.data[i]

    // Extract values using header mapping
    const rawFirstName = headerMapping.firstName ? row[headerMapping.firstName] : ''
    const rawLastName = headerMapping.lastName ? row[headerMapping.lastName] : ''
    const rawEmail = headerMapping.email ? row[headerMapping.email] : ''
    const rawPhone = headerMapping.phone ? row[headerMapping.phone] : ''

    // Trim whitespace
    const firstName = (rawFirstName || '').trim()
    const lastName = (rawLastName || '').trim()

    // Skip rows missing BOTH firstName AND lastName
    if (!firstName && !lastName) {
      skippedCount++
      continue
    }

    // Normalize email
    let email: string | null = null
    if (rawEmail && rawEmail.trim()) {
      const normalizedEmail = normalizeEmail(rawEmail)
      if (isValidEmail(normalizedEmail)) {
        email = normalizedEmail
      } else {
        invalidEmailCount++
      }
    }

    // Normalize phone
    let phone: string | null = null
    if (rawPhone && rawPhone.trim()) {
      const normalizedPhone = normalizePhone(rawPhone)
      if (normalizedPhone.length > 0) {
        phone = normalizedPhone
      }
    }

    records.push({
      firstName,
      lastName,
      email,
      phone,
    })
  }

  // Log parsing summary
  safeLog({
    event: 'csv_parse_complete',
    recordsFound: records.length,
    status: 'success',
    timestamp: new Date().toISOString(),
  })

  if (skippedCount > 0) {
    safeLog({
      event: 'csv_rows_skipped',
      recordsFound: skippedCount,
      status: 'warning',
      timestamp: new Date().toISOString(),
    })
  }

  if (invalidEmailCount > 0) {
    safeLog({
      event: 'csv_invalid_emails',
      recordsFound: invalidEmailCount,
      status: 'warning',
      timestamp: new Date().toISOString(),
    })
  }

  return records
}

/**
 * Validates that a CSV content string has the expected format
 * @param csvContent - Raw CSV string
 * @returns Object with isValid flag and any error message
 */
export function validateCSVFormat(csvContent: string): { isValid: boolean; error?: string } {
  try {
    if (!csvContent || csvContent.trim().length === 0) {
      return { isValid: false, error: 'CSV file is empty' }
    }

    const parseResult = Papa.parse<Record<string, string>>(csvContent, {
      header: true,
      preview: 1, // Only parse first row for validation
    })

    if (parseResult.errors.length > 0) {
      return { isValid: false, error: `Parse error: ${parseResult.errors[0].message}` }
    }

    const headers = parseResult.meta.fields || []
    const headerMapping = detectHeaders(headers)

    if (!headerMapping.firstName && !headerMapping.lastName) {
      return {
        isValid: false,
        error: 'Could not find name columns (first_name, last_name, etc.)',
      }
    }

    return { isValid: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { isValid: false, error: message }
  }
}
