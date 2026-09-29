import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { PAUSED_PLATFORMS, PLATFORMS, createOAuthState, type Platform } from "@social-suite/core";
import { getAdapter, hasAdapter } from "@social-suite/platforms";
import { getPlatformAppCredentials } from "@social-suite/db";
import { requireTenantContext } from "@/lib/tenant";

const SCOPES: Record<Platform, string[]> = {
  youtube: [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
  ],
  facebook: ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "pages_manage_engagement", "read_insights"],
  instagram: ["instagram_business_basic", "instagram_business_content_publish", "instagram_business_manage_insights"],
  threads: ["threads_basic", "threads_content_publish"],
  x: ["tweet.read", "tweet.write", "users.read", "offline.access"],
  douyin: ["user_info", "video.create.bind", "video.data", "item.comment"],
  bilibili: ["USER_INFO", "ARC_BASE", "ARC_DATA"],
  weibo: [],
  xiaohongshu: [],
  tiktok: ["user.info.basic", "video.list", "video.publish"],
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform: platformParam } = await params;
  if (!PLATFORMS.includes(platformParam as Platform)) {
    return NextResponse.json({ error: "Unknown platform" }, { status: 404 });
  }
  const platform = platformParam as Platform;
  if (PAUSED_PLATFORMS.has(platform)) {
    return NextResponse.json({ error: `${platform} connections are paused` }, { status: 404 });
  }

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
  if (platform === "youtube" && !appCredentials.clientId.endsWith(".apps.googleusercontent.com")) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=invalid_google_client_id", request.url),
    );
  }

  // X OAuth 2.0 requires PKCE. Keep the verifier inside our encrypted state so it
  // survives the provider redirect without needing server-side session storage.
  const pkceVerifier = platform === "x" ? randomBytes(48).toString("base64url") : undefined;
  const state = createOAuthState({ organizationId: ctx.organizationId, userId: ctx.userId, platform, pkceVerifier });
  const adapter = getAdapter(platform);
  const authorizeUrl = adapter.getAuthorizationUrl(state, SCOPES[platform], appCredentials, pkceVerifier);

  return NextResponse.redirect(authorizeUrl);
}
