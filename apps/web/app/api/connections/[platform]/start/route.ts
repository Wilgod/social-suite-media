import { NextRequest, NextResponse } from "next/server";
import { PLATFORMS, createOAuthState, type Platform } from "@social-suite/core";
import { getAdapter, hasAdapter } from "@social-suite/platforms";
import { getPlatformAppCredentials } from "@social-suite/db";
import { requireTenantContext } from "@/lib/tenant";

const SCOPES: Record<Platform, string[]> = {
  youtube: [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
  ],
  facebook: ["pages_show_list", "pages_manage_posts", "instagram_basic", "instagram_content_publish"],
  instagram: ["instagram_business_basic", "instagram_business_content_publish", "instagram_business_manage_insights"],
  threads: ["threads_basic", "threads_content_publish"],
  x: ["tweet.read", "tweet.write", "users.read", "offline.access"],
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform: platformParam } = await params;
  if (!PLATFORMS.includes(platformParam as Platform)) {
    return NextResponse.json({ error: "Unknown platform" }, { status: 404 });
  }
  const platform = platformParam as Platform;

  const ctx = await requireTenantContext();

  if (!hasAdapter(platform)) {
    return NextResponse.json({ error: `${platform} connections are not available yet` }, { status: 501 });
  }

  const appCredentials = await getPlatformAppCredentials(ctx.organizationId, platform);
  if (!appCredentials) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=missing_credentials", request.url),
    );
  }

  const state = createOAuthState({ organizationId: ctx.organizationId, userId: ctx.userId, platform });
  const adapter = getAdapter(platform);
  const authorizeUrl = adapter.getAuthorizationUrl(state, SCOPES[platform], appCredentials);

  return NextResponse.redirect(authorizeUrl);
}
