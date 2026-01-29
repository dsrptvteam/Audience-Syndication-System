import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const key = process.env.SFTP_ENCRYPTION_KEY
  if (!key) {
    throw new Error('SFTP_ENCRYPTION_KEY environment variable is not set')
  }
  // Ensure key is exactly 32 bytes for AES-256
  return Buffer.from(key.slice(0, 32).padEnd(32, '0'))
}

/**
 * Encrypts a password using AES-256-GCM
 * @param password - The plaintext password to encrypt
 * @returns Encrypted string in format: iv:authTag:encrypted (all hex encoded)
 */
export function encryptPassword(password: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(password, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Decrypts a password that was encrypted with encryptPassword
 * @param encryptedData - The encrypted string in format: iv:authTag:encrypted
 * @returns The decrypted plaintext password
 */
export function decryptPassword(encryptedData: string): string {
  const key = getEncryptionKey()

  const parts = encryptedData.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format')
  }

  const [ivHex, authTagHex, encrypted] = parts

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  if (iv.length !== IV_LENGTH) {
    throw new Error('Invalid IV length')
  }

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid auth tag length')
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
