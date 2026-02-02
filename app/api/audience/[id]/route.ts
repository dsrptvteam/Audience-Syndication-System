import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth, isSession } from '@/lib/auth-helper'
import { AUDIENCE_STATUS } from '@/lib/deduplication'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

// Validation schema for PATCH request
const updateSchema = z.object({
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
})

/**
 * GET /api/audience/[id]
 * Returns a single audience member with full details including client info
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  // Check authentication
  const authResult = await requireAuth()
  if (!isSession(authResult)) {
    return authResult
  }

  try {
    const { id } = await params
    const audienceId = parseInt(id, 10)

    if (isNaN(audienceId)) {
      return NextResponse.json(
        { error: 'Invalid audience member ID' },
        { status: 400 }
      )
    }

    const audienceMember = await prisma.audienceMember.findUnique({
      where: {
        id: audienceId,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            sftpHost: true,
            isActive: true,
          },
        },
      },
    })

    if (!audienceMember) {
      return NextResponse.json(
        { error: 'Audience member not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(audienceMember)
  } catch (error) {
    console.error('Error fetching audience member:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audience member' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/audience/[id]
 * Updates an audience member's details
 * Automatically updates status to ACTIVE if email or phone is added
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  // Check authentication
  const authResult = await requireAuth()
  if (!isSession(authResult)) {
    return authResult
  }

  try {
    const { id } = await params
    const audienceId = parseInt(id, 10)

    if (isNaN(audienceId)) {
      return NextResponse.json(
        { error: 'Invalid audience member ID' },
        { status: 400 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = updateSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Check if member exists
    const existingMember = await prisma.audienceMember.findUnique({
      where: { id: audienceId },
    })

    if (!existingMember) {
      return NextResponse.json(
        { error: 'Audience member not found' },
        { status: 404 }
      )
    }

    // Determine new values (use existing if not provided)
    const newEmail = data.email !== undefined ? data.email : existingMember.email
    const newPhone = data.phone !== undefined ? data.phone : existingMember.phone

    // Determine status based on identifiers
    const hasEmail = newEmail && newEmail.trim().length > 0
    const hasPhone = newPhone && newPhone.trim().length > 0
    const newStatus = hasEmail || hasPhone ? AUDIENCE_STATUS.ACTIVE : AUDIENCE_STATUS.NO_IDENTIFIER

    // Update the member
    const updatedMember = await prisma.audienceMember.update({
      where: { id: audienceId },
      data: {
        email: data.email !== undefined ? data.email : undefined,
        phone: data.phone !== undefined ? data.phone : undefined,
        firstName: data.firstName !== undefined ? data.firstName : undefined,
        lastName: data.lastName !== undefined ? data.lastName : undefined,
        status: newStatus,
        updatedAt: new Date(),
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json({
      ...updatedMember,
      message: newStatus === AUDIENCE_STATUS.ACTIVE && existingMember.status !== AUDIENCE_STATUS.ACTIVE
        ? 'Record updated and now eligible for Meta sync'
        : 'Record updated successfully',
    })
  } catch (error) {
    console.error('Error updating audience member:', error)
    return NextResponse.json(
      { error: 'Failed to update audience member' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/audience/[id]
 * Deletes an audience member
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  // Check authentication
  const authResult = await requireAuth()
  if (!isSession(authResult)) {
    return authResult
  }

  try {
    const { id } = await params
    const audienceId = parseInt(id, 10)

    if (isNaN(audienceId)) {
      return NextResponse.json(
        { error: 'Invalid audience member ID' },
        { status: 400 }
      )
    }

    // Check if member exists
    const existingMember = await prisma.audienceMember.findUnique({
      where: { id: audienceId },
    })

    if (!existingMember) {
      return NextResponse.json(
        { error: 'Audience member not found' },
        { status: 404 }
      )
    }

    // Delete the member
    await prisma.audienceMember.delete({
      where: { id: audienceId },
    })

    return NextResponse.json({
      success: true,
      message: 'Audience member deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting audience member:', error)
    return NextResponse.json(
      { error: 'Failed to delete audience member' },
      { status: 500 }
    )
  }
}
