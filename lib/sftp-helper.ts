import SFTPClient from 'ssh2-sftp-client'
import { prisma } from '@/lib/db'
import { decryptPassword } from '@/lib/encryption'
import { safeLog } from '@/lib/logger'

interface SFTPConnectionResult {
  client: SFTPClient
  clientData: {
    id: number
    name: string
    sftpDirectory: string
    filePattern: string
  }
}

interface DownloadResult {
  filename: string
  content: string
}

interface FileInfo {
  name: string
  modifyTime: number
  type: string
}

/**
 * Connects to SFTP server using client credentials from database
 * @param clientId - The database ID of the client
 * @returns Connected SFTP client instance and client data
 */
export async function connectToSFTP(clientId: string): Promise<SFTPConnectionResult> {
  const id = parseInt(clientId, 10)

  if (isNaN(id)) {
    throw new Error('Invalid client ID')
  }

  // Query database for client
  const client = await prisma.client.findUnique({
    where: { id },
  })

  if (!client) {
    throw new Error(`Client not found: ${clientId}`)
  }

  if (!client.isActive) {
    throw new Error(`Client is not active: ${client.name}`)
  }

  safeLog({
    event: 'sftp_connect_start',
    clientName: client.name,
    timestamp: new Date().toISOString(),
  })

  // Decrypt SFTP password
  let decryptedPassword: string
  try {
    decryptedPassword = decryptPassword(client.sftpPassword)
  } catch (_error) {
    safeLog({
      event: 'sftp_decrypt_failed',
      clientName: client.name,
      status: 'error',
      timestamp: new Date().toISOString(),
    })
    throw new Error('Invalid client credentials')
  }

  // Create SFTP connection
  const sftp = new SFTPClient()

  try {
    await sftp.connect({
      host: client.sftpHost,
      port: client.sftpPort,
      username: client.sftpUsername,
      password: decryptedPassword,
      readyTimeout: 30000,
      retries: 2,
      retry_minTimeout: 2000,
    })

    safeLog({
      event: 'sftp_connected',
      clientName: client.name,
      status: 'success',
      timestamp: new Date().toISOString(),
    })

    return {
      client: sftp,
      clientData: {
        id: client.id,
        name: client.name,
        sftpDirectory: client.sftpDirectory,
        filePattern: client.filePattern,
      },
    }
  } catch (error) {
    safeLog({
      event: 'sftp_connect_failed',
      clientName: client.name,
      status: 'error',
      timestamp: new Date().toISOString(),
    })

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`SFTP connection failed for ${client.name}: ${errorMessage}`)
  }
}

/**
 * Downloads the most recent CSV file from a client's SFTP folder
 * @param clientId - The database ID of the client
 * @returns The filename and content of the downloaded CSV
 */
export async function downloadLatestCSV(clientId: string): Promise<DownloadResult> {
  const { client: sftp, clientData } = await connectToSFTP(clientId)

  try {
    safeLog({
      event: 'sftp_list_files',
      clientName: clientData.name,
      timestamp: new Date().toISOString(),
    })

    // List files in client's folder path
    const fileList = await sftp.list(clientData.sftpDirectory)

    // Filter for .csv files only
    const csvFiles = fileList.filter((file): file is FileInfo & { type: '-' } => {
      return (
        file.type === '-' && // Regular file (not directory)
        file.name.toLowerCase().endsWith('.csv')
      )
    })

    if (csvFiles.length === 0) {
      throw new Error('No CSV files in folder')
    }

    safeLog({
      event: 'sftp_csv_files_found',
      clientName: clientData.name,
      recordsFound: csvFiles.length,
      timestamp: new Date().toISOString(),
    })

    // Find most recent by modification time
    const latestFile = csvFiles.reduce((latest, current) => {
      return current.modifyTime > latest.modifyTime ? current : latest
    })

    const filePath = `${clientData.sftpDirectory}/${latestFile.name}`

    safeLog({
      event: 'sftp_download_start',
      clientName: clientData.name,
      filename: latestFile.name,
      timestamp: new Date().toISOString(),
    })

    // Download file content as buffer, then convert to string
    const fileBuffer = await sftp.get(filePath)

    // Handle both Buffer and string returns from sftp.get
    let content: string
    if (Buffer.isBuffer(fileBuffer)) {
      content = fileBuffer.toString('utf-8')
    } else if (typeof fileBuffer === 'string') {
      content = fileBuffer
    } else {
      throw new Error('Unexpected file content type')
    }

    safeLog({
      event: 'sftp_download_complete',
      clientName: clientData.name,
      filename: latestFile.name,
      status: 'success',
      timestamp: new Date().toISOString(),
    })

    return {
      filename: latestFile.name,
      content,
    }
  } catch (error) {
    // Re-throw known errors
    if (error instanceof Error && error.message === 'No CSV files in folder') {
      throw error
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    safeLog({
      event: 'sftp_download_failed',
      clientName: clientData.name,
      status: 'error',
      timestamp: new Date().toISOString(),
    })

    throw new Error(`Failed to download CSV for ${clientData.name}: ${errorMessage}`)
  } finally {
    // Always close the connection
    await sftp.end()

    safeLog({
      event: 'sftp_connection_closed',
      clientName: clientData.name,
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Lists all CSV files in a client's SFTP folder
 * @param clientId - The database ID of the client
 * @returns Array of CSV filenames with their modification times
 */
export async function listCSVFiles(clientId: string): Promise<Array<{ name: string; modifyTime: Date }>> {
  const { client: sftp, clientData } = await connectToSFTP(clientId)

  try {
    const fileList = await sftp.list(clientData.sftpDirectory)

    const csvFiles = fileList
      .filter((file) => file.type === '-' && file.name.toLowerCase().endsWith('.csv'))
      .map((file) => ({
        name: file.name,
        modifyTime: new Date(file.modifyTime),
      }))
      .sort((a, b) => b.modifyTime.getTime() - a.modifyTime.getTime())

    return csvFiles
  } finally {
    await sftp.end()
  }
}
