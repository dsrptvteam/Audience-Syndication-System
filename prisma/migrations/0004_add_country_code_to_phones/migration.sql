-- Migration: Add country code to existing phone numbers
-- Updates all 10-digit phone numbers to include US country code (1)

-- Update audience_member phone numbers
-- Only update phones that are exactly 10 digits (no country code yet)
UPDATE audience_member
SET phone = '1' || phone
WHERE phone IS NOT NULL
  AND phone ~ '^\d{10}$'
  AND phone NOT LIKE '1%';

-- Log the migration
-- This ensures existing US phone numbers have the country code
-- New records will already have country code from csv-parser.normalizePhone()
