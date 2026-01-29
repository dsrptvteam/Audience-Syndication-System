# Deployment Checklist

Use this checklist to ensure all steps are completed for a successful production deployment.

## Pre-Deployment

### Database Setup (Supabase)

- [ ] Create Supabase project at [supabase.com](https://supabase.com)
- [ ] Copy connection pooler URL (port 6543) for `DATABASE_URL`
- [ ] Copy direct connection URL (port 5432) for `DIRECT_URL`
- [ ] Run migration `0001_init/migration.sql` in SQL Editor
- [ ] Run migration `0002_add_meta_fields/migration.sql` in SQL Editor
- [ ] Run migration `0003_add_purchase_client/migration.sql` in SQL Editor
- [ ] Verify tables created: `clients`, `audience_members`, `file_processing_log`, `meta_sync_log`, `purchase_removals`, `alert_recipients`

### External Services

- [ ] Create Resend account and get API key
- [ ] Verify sender domain in Resend (for `EMAIL_FROM`)
- [ ] Create Meta Developer account
- [ ] Create Meta App with Marketing API access
- [ ] Generate system user access token with `ads_management` permission
- [ ] Note Ad Account ID (format: `act_XXXXXXXX`)

### Security Keys

- [ ] Generate `NEXTAUTH_SECRET`: `openssl rand -base64 32`
- [ ] Generate `SFTP_ENCRYPTION_KEY`: `openssl rand -hex 32`
- [ ] Generate `CRON_SECRET`: `openssl rand -base64 32`

---

## Vercel Deployment

### Project Setup

- [ ] Connect GitHub repository to Vercel
- [ ] Select correct branch for production

### Environment Variables

Add all variables in Vercel project settings:

- [ ] `DATABASE_URL` - Supabase pooler connection string
- [ ] `DIRECT_URL` - Supabase direct connection string
- [ ] `NEXTAUTH_URL` - Vercel deployment URL (e.g., `https://your-app.vercel.app`)
- [ ] `NEXTAUTH_SECRET` - Generated secret
- [ ] `RESEND_API_KEY` - From Resend dashboard
- [ ] `EMAIL_FROM` - Verified sender email
- [ ] `META_APP_ID` - From Meta Developer dashboard
- [ ] `META_APP_SECRET` - From Meta Developer dashboard
- [ ] `META_ACCESS_TOKEN` - System user token
- [ ] `META_AD_ACCOUNT_ID` - Ad account ID with `act_` prefix
- [ ] `SFTP_ENCRYPTION_KEY` - Generated 64-char hex key
- [ ] `CRON_SECRET` - Generated secret

### Deploy

- [ ] Click Deploy
- [ ] Wait for build to complete
- [ ] Verify deployment URL is accessible
- [ ] Check build logs for any errors

---

## Post-Deployment Configuration

### Cron Job Setup

Option A: Vercel Dashboard
- [ ] Go to Vercel project > Settings > Cron Jobs
- [ ] Add cron: Path `/api/cron/daily`, Schedule `0 2 * * *`
- [ ] Set header `Authorization: Bearer {CRON_SECRET}`

Option B: vercel.json (alternative)
- [ ] Create `vercel.json` with cron configuration
- [ ] Redeploy to activate cron

### Alert Recipients

- [ ] Add at least one alert recipient in Supabase:
```sql
INSERT INTO alert_recipients (id, email, name, is_active)
VALUES (gen_random_uuid(), 'your-email@company.com', 'Your Name', true);
```

---

## Verification Tests

### Authentication

- [ ] Navigate to deployed app
- [ ] Click Sign In
- [ ] Enter email address
- [ ] Receive magic link email
- [ ] Click link and verify login works
- [ ] Verify dashboard loads

### Client Management

- [ ] Go to Dashboard > Clients
- [ ] Click "Add Client"
- [ ] Fill in test client details
- [ ] Save client successfully
- [ ] Verify client appears in list

### File Processing (requires real SFTP)

- [ ] Click "Process" on test client
- [ ] Check Processing History for status
- [ ] Verify records appear in Audience page
- [ ] Check for any error messages

### Meta Sync (requires Meta API access)

- [ ] Trigger sync via API or UI
- [ ] Check Meta Sync History for status
- [ ] Verify audience in Meta Ads Manager

### Purchase Removal

- [ ] Go to Dashboard > Purchases
- [ ] Upload test CSV file
- [ ] Verify removal records created
- [ ] Check matched/unmatched counts

### Cron Job

- [ ] Test endpoint: `GET /api/cron/test` (no auth required)
- [ ] Verify response is successful
- [ ] Wait for scheduled run or trigger manually
- [ ] Check for daily summary email

---

## Go-Live Checklist

- [ ] All tests above passing
- [ ] Production SFTP credentials configured for each client
- [ ] Alert recipients configured for notifications
- [ ] Team members have login access
- [ ] Backup/recovery plan documented
- [ ] Monitoring/alerting configured (optional)

---

## Troubleshooting Quick Reference

| Issue | Check |
|-------|-------|
| Database connection fails | Verify `DATABASE_URL` uses port 6543 (pooler) |
| Auth not working | Verify `NEXTAUTH_URL` matches deployment URL exactly |
| Emails not sending | Check Resend API key and domain verification |
| Meta sync fails | Verify token has `ads_management` permission |
| Cron not running | Check `CRON_SECRET` matches Authorization header |
| SFTP connection fails | Test credentials manually, check firewall rules |

---

## Support

For issues or questions:
1. Check Vercel function logs for errors
2. Check Supabase logs for database issues
3. Review Resend dashboard for email delivery
4. Check Meta Business Manager for API issues
