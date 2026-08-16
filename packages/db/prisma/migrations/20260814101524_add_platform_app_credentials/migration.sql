-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('google', 'meta', 'threads', 'x');

-- CreateTable
CREATE TABLE "platform_app_credentials" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "clientId" TEXT NOT NULL,
    "encryptedClientSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_app_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_app_credentials_organizationId_provider_key" ON "platform_app_credentials"("organizationId", "provider");

-- AddForeignKey
ALTER TABLE "platform_app_credentials" ADD CONSTRAINT "platform_app_credentials_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
