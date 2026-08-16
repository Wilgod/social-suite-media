import { NextRequest, NextResponse } from "next/server";
import { PLATFORMS, encryptSecret, verifyOAuthState, type Platform } from "@social-suite/core";
import { getAdapter, hasAdapter } from "@social-suite/platforms";
import { prisma, getPlatformAppCredentials, type Prisma } from "@social-suite/db";

function redirectToConnections(request: NextRequest, query: string) {
  return NextResponse.redirect(new URL(`/dashboard/connections?${query}`, request.url));
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform: platformParam } = await params;
  if (!PLATFORMS.includes(platformParam as Platform)) {
    return NextResponse.json({ error: "Unknown platform" }, { status: 404 });
  }
  const platform = platformParam as Platform;

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) return redirectToConnections(request, `error=${encodeURIComponent(oauthError)}`);
  if (!code || !stateParam) return redirectToConnections(request, "error=missing_code");

  let state;
  try {
    state = verifyOAuthState(stateParam);
  } catch {
    return redirectToConnections(request, "error=invalid_state");
  }

  if (state.platform !== platform) return redirectToConnections(request, "error=platform_mismatch");
  if (!hasAdapter(platform)) return redirectToConnections(request, "error=unsupported_platform");

  const appCredentials = await getPlatformAppCredentials(state.organizationId, platform);
  if (!appCredentials) return redirectToConnections(request, "error=missing_credentials");

  const adapter = getAdapter(platform);

  try {
    const tokens = await adapter.exchangeCodeForTokens(code, appCredentials, state.pkceVerifier);
    const identities = await adapter.fetchAccountIdentity(tokens.accessToken);
    const identityList = Array.isArray(identities) ? identities : [identities];

    for (const identity of identityList) {
      const socialAccount = await prisma.socialAccount.upsert({
        where: {
          organizationId_platform_platformAccountId: {
            organizationId: state.organizationId,
            platform,
            platformAccountId: identity.externalId,
          },
        },
        create: {
          organizationId: state.organizationId,
          platform,
          platformAccountId: identity.externalId,
          displayName: identity.displayName,
          avatarUrl: identity.avatarUrl,
          status: "active",
          platformMetadata: (identity.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
          connectedByUserId: state.userId,
        },
        update: {
          displayName: identity.displayName,
          avatarUrl: identity.avatarUrl,
          status: "active",
          platformMetadata: (identity.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });

      await prisma.oAuthCredential.upsert({
        where: { socialAccountId: socialAccount.id },
        create: {
          socialAccountId: socialAccount.id,
          encryptedAccessToken: encryptSecret(tokens.accessToken),
          encryptedRefreshToken: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : undefined,
          tokenExpiresAt: tokens.expiresAt,
          scopesGranted: tokens.scopes,
        },
        update: {
          encryptedAccessToken: encryptSecret(tokens.accessToken),
          encryptedRefreshToken: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : undefined,
          tokenExpiresAt: tokens.expiresAt,
          scopesGranted: tokens.scopes,
          lastRefreshedAt: new Date(),
        },
      });

      if (adapter.fetchDailyStats) {
        try {
          const since = new Date();
          since.setUTCDate(since.getUTCDate() - 30);

          const stats = await adapter.fetchDailyStats(tokens.accessToken, since);
          for (const stat of stats) {
            const date = new Date(`${stat.date}T00:00:00.000Z`);
            await prisma.analyticsSnapshot.upsert({
              where: { socialAccountId_date: { socialAccountId: socialAccount.id, date } },
              create: {
                organizationId: state.organizationId,
                socialAccountId: socialAccount.id,
                date,
                views: stat.views,
                likes: stat.likes,
                comments: stat.comments,
                subscribersGained: stat.subscribersGained,
                subscribersLost: stat.subscribersLost,
                estimatedMinutesWatched: stat.estimatedMinutesWatched,
              },
              update: {
                views: stat.views,
                likes: stat.likes,
                comments: stat.comments,
                subscribersGained: stat.subscribersGained,
                subscribersLost: stat.subscribersLost,
                estimatedMinutesWatched: stat.estimatedMinutesWatched,
              },
            });
          }
        } catch (err) {
          // A failed backfill shouldn't block the connection itself — the daily worker sync will retry.
          console.error(`Analytics backfill failed for ${platform}`, err);
        }
      }
    }
  } catch (err) {
    console.error(`OAuth callback failed for ${platform}`, err);
    return redirectToConnections(request, "error=connect_failed");
  }

  return redirectToConnections(request, "connected=1");
}
