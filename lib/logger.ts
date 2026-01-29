// List of fields that are safe to log
const SAFE_FIELDS = new Set([
  'filename',
  'recordsFound',
  'clientName',
  'status',
  'timestamp',
  'event',
])

// Patterns that indicate sensitive data (case insensitive)
const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /key/i,
  /secret/i,
  /credential/i,
]

/**
 * Checks if a field name matches any sensitive pattern
 */
function isSensitiveField(fieldName: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(fieldName))
}

/**
 * Safely logs data by filtering out sensitive fields
 * Only logs fields that are in the SAFE_FIELDS list and don't match sensitive patterns
 * @param data - Object containing fields to potentially log
 */
export function safeLog(data: Record<string, unknown>): void {
  const safeData: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(data)) {
    // Only include if it's a safe field AND not matching sensitive patterns
    if (SAFE_FIELDS.has(key) && !isSensitiveField(key)) {
      safeData[key] = value
    }
  }

  // Only log if there's at least one safe field
  if (Object.keys(safeData).length > 0) {
    console.log(JSON.stringify(safeData))
  }
}
