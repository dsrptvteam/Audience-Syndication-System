-- Migration: Add isActive and createdAt to User model
-- Adds ability to activate/deactivate system users

-- Add isActive column (default true for existing users)
ALTER TABLE users
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Add createdAt column (default to now for existing users)
ALTER TABLE users
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
