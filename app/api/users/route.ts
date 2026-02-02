import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, isSession } from '@/lib/auth-helper'

/**
 * GET /api/users
 * Returns all system users with last login information
 */
export async function GET() {
  const authResult = await requireAuth()
  if (!isSession(authResult)) {
    return authResult
  }

  try {
    // Fetch all users with their most recent session
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        isActive: true,
        createdAt: true,
        sessions: {
          orderBy: { expires: 'desc' },
          take: 1,
          select: { expires: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Format response with last login info
    const formattedUsers = users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      isActive: user.isActive,
      createdAt: user.createdAt?.toISOString() || null,
      lastLoginAt: user.sessions[0]?.expires
        ? new Date(user.sessions[0].expires).toISOString()
        : null,
    }))

    return NextResponse.json({ users: formattedUsers })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/users
 * Creates a new user (invitation)
 * Note: This creates a user record but doesn't send an email
 * Email sending would require Resend integration
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) {
    return authResult
  }

  try {
    const body = await request.json()
    const { email, name } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      )
    }

    // Create new user
    const user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
      },
    })

    // TODO: Send invitation email via Resend
    // This would require setting up email templates and Resend API

    return NextResponse.json({
      user,
      message: 'User created successfully',
    })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}
