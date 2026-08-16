import { PROVIDER_BY_PLATFORM, decryptSecret, type Platform, type PlatformAppCredentials } from "@social-suite/core";
import { prisma } from "./client";

/** Looks up and decrypts the organization's OAuth app credentials for the given platform's provider. */
export async function getPlatformAppCredentials(
  organizationId: string,
  platform: Platform,
): Promise<PlatformAppCredentials | null> {
  const provider = PROVIDER_BY_PLATFORM[platform];
  const row = await prisma.platformAppCredential.findUnique({
    where: { organizationId_provider: { organizationId, provider } },
  });
  if (!row) return null;

  return { clientId: row.clientId, clientSecret: decryptSecret(row.encryptedClientSecret) };
}
