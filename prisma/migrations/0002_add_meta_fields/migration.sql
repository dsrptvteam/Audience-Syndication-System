-- Add metaAudienceId to clients table
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "metaAudienceId" TEXT;

-- Add clientId and audienceId to meta_sync_log table
ALTER TABLE "meta_sync_log" ADD COLUMN IF NOT EXISTS "clientId" INTEGER;
ALTER TABLE "meta_sync_log" ADD COLUMN IF NOT EXISTS "audienceId" TEXT;

-- Create index on meta_sync_log.clientId
CREATE INDEX IF NOT EXISTS "meta_sync_log_clientId_idx" ON "meta_sync_log"("clientId");

-- Add foreign key constraint for meta_sync_log.clientId
-- Note: Only add if clientId is NOT NULL, otherwise this will fail for existing rows
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'meta_sync_log_clientId_fkey'
    ) THEN
        ALTER TABLE "meta_sync_log"
        ADD CONSTRAINT "meta_sync_log_clientId_fkey"
        FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
