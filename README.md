# Audience Syndication System

Automated audience synchronization system that downloads CSV files from client SFTP servers, deduplicates records, and syncs to Meta (Facebook) Custom Audiences.

## Features

- **SFTP Integration**: Automatically download audience CSV files from client SFTP servers
- **Flexible CSV Parsing**: Handle various column naming conventions with smart header mapping
- **Progressive Deduplication**: Match records by email+name, then phone+name to prevent duplicates
- **Meta Custom Audiences**: Sync audience data to Facebook/Instagram ad targeting
- **Purchase Removal**: Upload purchase lists to remove buyers from audiences
- **90-Day Retention**: Automatic expiration of audience records per compliance requirements
- **Daily Cron Jobs**: Automated processing and cleanup with email notifications
- **Dashboard UI**: Manage clients, view audience members, and monitor processing

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **Authentication**: NextAuth.js with magic link (Resend)
- **Styling**: Tailwind CSS + shadcn/ui components
- **APIs**: Meta Marketing API, Resend Email

## Prerequisites

Before deploying, ensure you have:

1. **Supabase Account**: [supabase.com](https://supabase.com) - Free tier works
2. **Vercel Account**: [vercel.com](https://vercel.com) - Free tier works
3. **Resend Account**: [resend.com](https://resend.com) - For email notifications
4. **Meta Developer Account**: [developers.facebook.com](https://developers.facebook.com) - For Custom Audiences API

## Local Development

```bash
# Clone the repository
git clone <your-repo-url>
cd audience-syndication-system

# Install dependencies
npm install

# Copy environment variables
cp .env.production.example .env.local

# Edit .env.local with your values
nano .env.local

# Run database migrations (in Supabase SQL Editor)
# See prisma/migrations/ folder for SQL files

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev
```

## Vercel Deployment

### Step 1: Connect Repository

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Select the repository containing this project

### Step 2: Configure Environment Variables

In the Vercel project settings, add these environment variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase connection pooler URL |
| `DIRECT_URL` | Supabase direct connection URL |
| `NEXTAUTH_URL` | Your Vercel deployment URL (e.g., `https://your-app.vercel.app`) |
| `NEXTAUTH_SECRET` | Random 32+ character secret |
| `RESEND_API_KEY` | Resend API key |
| `EMAIL_FROM` | Verified sender email |
| `META_APP_ID` | Meta App ID |
| `META_APP_SECRET` | Meta App Secret |
| `META_ACCESS_TOKEN` | Meta system user access token |
| `META_AD_ACCOUNT_ID` | Meta Ad Account ID (format: `act_XXX`) |
| `SFTP_ENCRYPTION_KEY` | 64-character hex string |
| `CRON_SECRET` | Random secret for cron authentication |

### Step 3: Deploy

Click "Deploy" and wait for the build to complete.

### Step 4: Run Database Migrations

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run each migration file from `prisma/migrations/` in order:
   - `0001_init/migration.sql`
   - `0002_add_meta_fields/migration.sql`
   - `0003_add_purchase_client/migration.sql`

### Step 5: Configure Cron Job

1. Go to your Vercel project dashboard
2. Navigate to Settings > Cron Jobs
3. Add a new cron job:
   - **Path**: `/api/cron/daily`
   - **Schedule**: `0 2 * * *` (runs at 2 AM UTC daily)
4. Add header for authentication:
   - **Header**: `Authorization`
   - **Value**: `Bearer YOUR_CRON_SECRET`

Alternatively, create `vercel.json` in your project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/daily",
      "schedule": "0 2 * * *"
    }
  ]
}
```

Note: Vercel automatically adds the `CRON_SECRET` environment variable as the Authorization header when using `vercel.json` cron configuration.

## Post-Deployment Setup

### 1. Add Alert Recipients

Insert alert recipients directly in Supabase:

```sql
INSERT INTO alert_recipients (id, email, name, is_active)
VALUES (
  gen_random_uuid(),
  'admin@yourcompany.com',
  'Admin User',
  true
);
```

### 2. First Login

1. Navigate to your deployed app
2. Click "Sign In"
3. Enter your email (must be an alert recipient or any email for testing)
4. Check your email for the magic link
5. Click the link to authenticate

### 3. Add Your First Client

1. Go to Dashboard > Clients
2. Click "Add Client"
3. Fill in client details:
   - **Name**: Client company name
   - **SFTP Host**: Client's SFTP server hostname
   - **SFTP Port**: Usually 22
   - **SFTP Username**: SFTP login username
   - **SFTP Password**: SFTP login password (encrypted at rest)
   - **SFTP Path**: Directory path to CSV files
   - **Retention Days**: Default 90

### 4. Test Processing

1. From the Clients page, click "Process" on your test client
2. Monitor the Processing History page for status
3. Check the Audience page for imported records

### 5. Test Meta Sync

After processing, sync to Meta:

```bash
curl -X POST https://your-app.vercel.app/api/meta/sync \
  -H "Content-Type: application/json" \
  -d '{"clientId": "your-client-id"}'
```

## API Endpoints

### Clients
- `GET /api/clients` - List all clients
- `POST /api/clients` - Create new client

### Audience
- `GET /api/audience` - List audience members (paginated)
- `GET /api/audience/stats` - Dashboard statistics
- `GET /api/audience/[id]` - Individual member details

### Processing
- `POST /api/process` - Trigger SFTP processing for a client
- `GET /api/process/history` - Processing history

### Meta Sync
- `POST /api/meta/sync` - Sync audience to Meta Custom Audience
- `GET /api/meta/sync/history` - Sync history

### Purchases
- `POST /api/purchases/upload` - Upload purchase CSV for removal
- `GET /api/purchases/history` - Purchase removal history

### Cron
- `GET /api/cron/daily` - Daily automation (requires Bearer token)
- `GET /api/cron/test` - Test cron without processing

## Project Structure

```
├── app/
│   ├── api/                    # API routes
│   │   ├── auth/               # NextAuth endpoints
│   │   ├── clients/            # Client management
│   │   ├── audience/           # Audience queries
│   │   ├── process/            # File processing
│   │   ├── meta/               # Meta API sync
│   │   ├── purchases/          # Purchase removal
│   │   └── cron/               # Scheduled jobs
│   ├── auth/                   # Auth pages
│   └── dashboard/              # Dashboard pages
├── components/
│   ├── providers.tsx           # React context providers
│   └── ui/                     # shadcn/ui components
├── lib/
│   ├── db.ts                   # Prisma client
│   ├── auth-helper.ts          # Auth utilities
│   ├── csv-parser.ts           # CSV parsing
│   ├── deduplication.ts        # Dedup algorithm
│   ├── encryption.ts           # AES encryption
│   ├── email-templates.ts      # Email HTML templates
│   ├── logger.ts               # Safe logging
│   ├── meta-api.ts             # Meta API client
│   ├── sftp-helper.ts          # SFTP operations
│   ├── utils.ts                # General utilities
│   └── validation.ts           # Zod schemas
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── migrations/             # SQL migrations
└── middleware.ts               # Route protection
```

## Security Considerations

- SFTP passwords are encrypted with AES-256-GCM before storage
- PII is hashed with SHA256 before sending to Meta
- All dashboard routes require authentication
- Cron endpoints require Bearer token authentication
- Sensitive fields are filtered from logs

## Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` uses the connection pooler URL (port 6543)
- Ensure your IP is allowed in Supabase network settings

### Meta API Errors
- Check that your access token has `ads_management` permission
- Verify the Ad Account ID format includes `act_` prefix
- Ensure the system user has access to the ad account

### Email Not Sending
- Verify Resend API key is valid
- Check that sender domain is verified in Resend
- Review Resend dashboard for delivery logs

### Cron Job Not Running
- Verify `CRON_SECRET` matches the Authorization header
- Check Vercel function logs for errors
- Test manually: `GET /api/cron/test`

## License

Private - All rights reserved.
