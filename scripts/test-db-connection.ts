import { prisma } from '../lib/db'

async function testConnection() {
  console.log('Testing database connection...')

  try {
    // Try to query the clients table
    const clients = await prisma.client.findMany()
    console.log('Connection successful!')
    console.log(`Found ${clients.length} clients in database`)

    // Also test other tables exist
    const audienceCount = await prisma.audienceMember.count()
    console.log(`Found ${audienceCount} audience members`)

    const alertRecipients = await prisma.alertRecipient.count()
    console.log(`Found ${alertRecipients} alert recipients`)

    console.log('\nAll tables accessible!')
  } catch (error) {
    console.error('Connection failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()
