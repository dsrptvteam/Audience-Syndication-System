-- CreateTable
CREATE TABLE IF NOT EXISTS "clients" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sftpHost" TEXT NOT NULL,
    "sftpPort" INTEGER NOT NULL DEFAULT 22,
    "sftpUsername" TEXT NOT NULL,
    "sftpPassword" TEXT NOT NULL,
    "sftpDirectory" TEXT NOT NULL,
    "filePattern" TEXT NOT NULL DEFAULT '*.csv',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "audience_members" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "dateAdded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "daysRemaining" INTEGER NOT NULL DEFAULT 180,
    "sourceFile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audience_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "file_processing_log" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "recordsTotal" INTEGER NOT NULL DEFAULT 0,
    "recordsNew" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "recordsSkipped" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_processing_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "meta_sync_log" (
    "id" SERIAL NOT NULL,
    "syncType" TEXT NOT NULL,
    "recordsTotal" INTEGER NOT NULL DEFAULT 0,
    "recordsSuccess" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_sync_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "purchase_removals" (
    "id" SERIAL NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "removedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceFile" TEXT,

    CONSTRAINT "purchase_removals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "alert_recipients" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "clients_name_key" ON "clients"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audience_members_email_idx" ON "audience_members"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audience_members_phone_idx" ON "audience_members"("phone");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audience_members_firstName_lastName_idx" ON "audience_members"("firstName", "lastName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audience_members_dateAdded_idx" ON "audience_members"("dateAdded");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audience_members_daysRemaining_idx" ON "audience_members"("daysRemaining");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audience_members_clientId_idx" ON "audience_members"("clientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "file_processing_log_clientId_idx" ON "file_processing_log"("clientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "file_processing_log_processedAt_idx" ON "file_processing_log"("processedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "meta_sync_log_syncedAt_idx" ON "meta_sync_log"("syncedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "purchase_removals_email_idx" ON "purchase_removals"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "purchase_removals_phone_idx" ON "purchase_removals"("phone");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "alert_recipients_email_key" ON "alert_recipients"("email");

-- AddForeignKey
ALTER TABLE "audience_members" ADD CONSTRAINT "audience_members_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_processing_log" ADD CONSTRAINT "file_processing_log_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
