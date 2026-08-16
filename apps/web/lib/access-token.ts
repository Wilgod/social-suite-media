import { decryptSecret, encryptSecret, type Platform } from "@social-suite/core";
import { prisma, getPlatformAppCredentials } from "@social-suite/db";
import { getAdapter } from "@social-suite/platforms";

const REFRESH_MARGIN_MS = 5 * 60 * 1000;

interface StoredCredential {
  id: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string | null;
  tokenExpiresAt: Date | null;
}

/** Returns a usable access token, refreshing and persisting it first if it's expiring soon. */
export async function getValidAccessToken(
  organizationId: string,
  platform: Platform,
  credential: StoredCredential,
): Promise<string> {
  const isExpiringSoon =
    credential.tokenExpiresAt && credential.tokenExpiresAt.getTime() - Date.now() < REFRESH_MARGIN_MS;

  if (!isExpiringSoon || !credential.encryptedRefreshToken) {
    return decryptSecret(credential.encryptedAccessToken);
  }

  const appCredentials = await getPlatformAppCredentials(organizationId, platform);
  if (!appCredentials) {
    throw new Error(`No ${platform} app credentials configured for this workspace`);
  }

  const adapter = getAdapter(platform);
  const refreshed = await adapter.refreshAccessToken(decryptSecret(credential.encryptedRefreshToken), appCredentials);

  await prisma.oAuthCredential.update({
    where: { id: credential.id },
    data: {
      encryptedAccessToken: encryptSecret(refreshed.accessToken),
      encryptedRefreshToken: refreshed.refreshToken ? encryptSecret(refreshed.refreshToken) : undefined,
      tokenExpiresAt: refreshed.expiresAt,
      lastRefreshedAt: new Date(),
    },
  });

  return refreshed.accessToken;
}
