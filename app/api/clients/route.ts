import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { clientSchema } from '@/lib/validation'
import { encryptPassword } from '@/lib/encryption'
import { requireAuth, isSession } from '@/lib/auth-helper'

/**
 * GET /api/clients
 * Returns all clients ordered by creation date (newest first)
 * Passwords are not included in the response
 */
export async function GET() {
  // Check authentication
  const authResult = await requireAuth()
  if (!isSession(authResult)) {
    return authResult
  }

  try {
    const clients = await prisma.client.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        sftpHost: true,
        sftpPort: true,
        sftpUsername: true,
        sftpDirectory: true,
        filePattern: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // Explicitly exclude sftpPassword
      },
    })

    return NextResponse.json(clients)
  } catch (error) {
    console.error('Error fetching clients:', error)
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/clients
 * Creates a new client with encrypted SFTP password
 */
export async function POST(request: NextRequest) {
  // Check authentication
  const authResult = await requireAuth()
  if (!isSession(authResult)) {
    return authResult
  }

  try {
    const body = await request.json()

    // Validate request body
    const validationResult = clientSchema.safeParse({
      ...body,
      // Map sftpFolderPath to sftpDirectory for schema validation
      sftpFolderPath: body.sftpFolderPath || body.sftpDirectory,
    })

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { name, sftpHost, sftpPort, sftpUsername, sftpPassword, sftpFolderPath } = validationResult.data

    // Check if client name already exists
    const existingClient = await prisma.client.findUnique({
      where: { name },
    })

    if (existingClient) {
      return NextResponse.json(
        { error: 'A client with this name already exists' },
        { status: 409 }
      )
    }

    // Encrypt the SFTP password before storing
    const encryptedPassword = encryptPassword(sftpPassword)

    // Create the client
    const client = await prisma.client.create({
      data: {
        name,
        sftpHost,
        sftpPort,
        sftpUsername,
        sftpPassword: encryptedPassword,
        sftpDirectory: sftpFolderPath,
      },
      select: {
        id: true,
        name: true,
        sftpHost: true,
        sftpPort: true,
        sftpUsername: true,
        sftpDirectory: true,
        filePattern: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // Explicitly exclude sftpPassword
      },
    })

    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    console.error('Error creating client:', error)
    return NextResponse.json(
      { error: 'Failed to create client' },
      { status: 500 }
    )
  }
}
