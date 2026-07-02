-- CreateTable
CREATE TABLE "ValidationRequest" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalizedEmail" TEXT,
    "status" TEXT NOT NULL,
    "subStatus" TEXT,
    "risk" TEXT,
    "score" INTEGER,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationResult" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "localPart" TEXT,
    "domain" TEXT,
    "syntaxValid" BOOLEAN NOT NULL DEFAULT false,
    "domainValid" BOOLEAN NOT NULL DEFAULT false,
    "dnsFound" BOOLEAN NOT NULL DEFAULT false,
    "mxFound" BOOLEAN NOT NULL DEFAULT false,
    "nullMx" BOOLEAN NOT NULL DEFAULT false,
    "disposable" BOOLEAN NOT NULL DEFAULT false,
    "roleBased" BOOLEAN NOT NULL DEFAULT false,
    "freeEmail" BOOLEAN NOT NULL DEFAULT false,
    "typoDetected" BOOLEAN NOT NULL DEFAULT false,
    "didYouMean" TEXT,
    "mxRecords" JSONB,
    "aRecords" JSONB,
    "aaaaRecords" JSONB,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValidationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisposableDomain" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "source" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisposableDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleBasedPrefix" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleBasedPrefix_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ValidationRequest_email_idx" ON "ValidationRequest"("email");

-- CreateIndex
CREATE INDEX "ValidationRequest_createdAt_idx" ON "ValidationRequest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationResult_requestId_key" ON "ValidationResult"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "DisposableDomain_domain_key" ON "DisposableDomain"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "RoleBasedPrefix_prefix_key" ON "RoleBasedPrefix"("prefix");

-- AddForeignKey
ALTER TABLE "ValidationResult" ADD CONSTRAINT "ValidationResult_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ValidationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
