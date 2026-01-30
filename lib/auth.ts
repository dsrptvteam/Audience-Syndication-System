import { AuthOptions } from 'next-auth'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import EmailProvider from 'next-auth/providers/email'
import { Resend } from 'resend'
import { prisma } from '@/lib/db'

const resend = new Resend(process.env.RESEND_API_KEY)

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    EmailProvider({
      from: process.env.EMAIL_FROM,
      sendVerificationRequest: async ({ identifier: email, url }) => {
        try {
          await resend.emails.send({
            from: process.env.EMAIL_FROM || 'noreply@example.com',
            to: email,
            subject: 'Sign in to Audience Syndication System',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Sign in to Audience Syndication System</h2>
                <p>Click the button below to sign in to your account:</p>
                <a href="${url}" style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 16px 0;">
                  Sign In
                </a>
                <p style="color: #666; font-size: 14px;">
                  If you didn't request this email, you can safely ignore it.
                </p>
                <p style="color: #666; font-size: 12px;">
                  This link expires in 24 hours.
                </p>
              </div>
            `,
          })
        } catch (error) {
          console.error('Failed to send verification email:', error)
          throw new Error('Failed to send verification email')
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    async signIn() {
      return true // Allow all sign-ins
    },
    async redirect({ url, baseUrl }) {
      // Always redirect to dashboard after sign-in
      if (url.startsWith('/')) return `${baseUrl}${url}`
      else if (new URL(url).origin === baseUrl) return url
      return `${baseUrl}/dashboard`
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as { id?: string }).id = token.id as string
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
