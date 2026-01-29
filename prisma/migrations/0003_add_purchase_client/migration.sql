-- Add clientId to purchase_removals table
ALTER TABLE "purchase_removals" ADD COLUMN IF NOT EXISTS "clientId" INTEGER;

-- Create index on purchase_removals.clientId
CREATE INDEX IF NOT EXISTS "purchase_removals_clientId_idx" ON "purchase_removals"("clientId");

-- Create index on purchase_removals.removedAt
CREATE INDEX IF NOT EXISTS "purchase_removals_removedAt_idx" ON "purchase_removals"("removedAt");

-- Add foreign key constraint for purchase_removals.clientId
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'purchase_removals_clientId_fkey'
    ) THEN
        ALTER TABLE "purchase_removals"
        ADD CONSTRAINT "purchase_removals_clientId_fkey"
        FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
