import { OAUTH_PROVIDERS, encryptSecret, type OAuthProvider } from "@social-suite/core";
import { prisma } from "@social-suite/db";
import { requireTenantContext } from "@/lib/tenant";
import { revalidatePath } from "next/cache";

interface ProviderInfo {
  label: string;
  covers: string;
  docsHint: string;
  consoleLabel: string;
  consoleUrl: string;
  steps: string[];
  stepsZh: string[];
  redirectPaths: string[];
  scopes: string[];
}

const PROVIDER_INFO: Record<OAuthProvider, ProviderInfo> = {
  google: {
    label: "Google (YouTube)",
    covers: "Powers the YouTube connection.",
    docsHint: "From a Google Cloud project with the YouTube Data API v3 enabled.",
    consoleLabel: "Google Cloud Console",
    consoleUrl: "https://console.cloud.google.com",
    steps: [
      "Create or select a project in Google Cloud Console.",
      'Go to "APIs & Services → Library" and enable both "YouTube Data API v3" and "YouTube Analytics API".',
      'Go to "APIs & Services → OAuth consent screen" and configure it (External is fine for most cases). Add the scopes listed below, and add your own Google account under "Test users" while the app is unpublished.',
      'Go to "APIs & Services → Credentials → Create Credentials → OAuth client ID". Choose "Web application".',
      "Add the redirect URI below under Authorized redirect URIs.",
      "Copy the generated Client ID and Client Secret into the form below.",
    ],
    stepsZh: [
      "在 Google Cloud Console 建立或選擇一個專案。",
      "前往「API 和服務 → 資料庫」，啟用「YouTube Data API v3」和「YouTube Analytics API」這兩個 API。",
      "前往「API 和服務 → OAuth 同意畫面」進行設定（大多數情況選「外部」即可）。加入下方列出的權限範圍，並在應用程式尚未發布前，於「測試使用者」中加入你自己的 Google 帳號。",
      "前往「API 和服務 → 憑證 → 建立憑證 → OAuth 用戶端 ID」，類型選擇「網路應用程式」。",
      "在「已授權的重新導向 URI」中加入下方的重新導向 URI。",
      "將產生的用戶端 ID 和用戶端密鑰複製到下方表單中。",
    ],
    redirectPaths: ["/api/connections/youtube/callback"],
    scopes: ["youtube.upload", "youtube.readonly", "yt-analytics.readonly"],
  },
  meta: {
    label: "Meta",
    covers: "Powers the Facebook Page connection.",
    docsHint: "From a Meta app with Facebook Login + Graph API access.",
    consoleLabel: "Meta for Developers",
    consoleUrl: "https://developers.facebook.com/apps",
    steps: [
      'Create an app at developers.facebook.com → "Create App" → type "Business".',
      'Add the "Facebook Login" product.',
      'Under "Facebook Login → Settings", add the redirect URI below to Valid OAuth Redirect URIs.',
      'Find the App ID and App Secret under "App Settings → Basic".',
      "For real (non-test) users, submit the app for App Review to request the scopes below — until then it only works for admins/testers added to the app.",
    ],
    stepsZh: [
      "在 developers.facebook.com 建立應用程式 →「建立應用程式」→ 類型選擇「商業」。",
      "加入「Facebook 登入」產品功能。",
      "在「Facebook 登入 → 設定」中，將下方的重新導向 URI 加入「有效的 OAuth 重新導向 URI」。",
      "在「應用程式設定 → 基本資料」中找到應用程式編號和應用程式密鑰。",
      "若要讓正式（非測試）使用者使用，需提交應用程式審查以申請下方的權限範圍——在審查通過前，僅限已加入應用程式的管理員／測試人員使用。",
    ],
    redirectPaths: ["/api/connections/facebook/callback"],
    scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"],
  },
  instagram: {
    label: "Instagram",
    covers: "Powers the Instagram connection — no Facebook account or Page required.",
    docsHint: 'Uses "Instagram API with Instagram Login" — a separate app ID/secret from any Facebook app.',
    consoleLabel: "Meta for Developers",
    consoleUrl: "https://developers.facebook.com/apps",
    steps: [
      'In the Instagram app: menu (☰) → "Settings and activity" → "For professionals" → "Account type and tools" → "Switch to professional account" → choose Creator or Business. Personal accounts can\'t use the API.',
      'Create an app at developers.facebook.com → "Create App" → type "Other" → "Business" (or reuse an existing app).',
      'Add the "Instagram" product, then choose "API setup with Instagram login" (not the Facebook Login variant).',
      "On that product's setup page, add the redirect URI below and add your Instagram account as a tester (while the app is unpublished, only testers can connect).",
      "Copy the Instagram App ID and Instagram App Secret shown on that same page — these are different from any Facebook App ID/Secret on this same app.",
      "For real (non-test) users, submit the app for App Review to request the scopes below.",
    ],
    stepsZh: [
      "在 Instagram App 中：選單（☰）→「設定和隱私」→「專業帳號相關」→「帳號類型和工具」→「切換為專業帳號」→ 選擇「創作者」或「商業」。個人帳號無法使用此 API。",
      "在 developers.facebook.com 建立應用程式 →「建立應用程式」→ 類型選擇「其他」→「商業」（也可以使用現有的應用程式）。",
      "加入「Instagram」產品功能，然後選擇「使用 Instagram 登入設定 API」（不是 Facebook 登入的版本）。",
      "在該產品的設定頁面中，加入下方的重新導向 URI，並將你的 Instagram 帳號加入「測試人員」（應用程式尚未發布前，只有測試人員可以連接）。",
      "複製該頁面上顯示的 Instagram 應用程式編號和應用程式密鑰——這與同一個應用程式中任何 Facebook 應用程式編號／密鑰是不同的。",
      "若要讓正式（非測試）使用者使用，需提交應用程式審查以申請下方的權限範圍。",
    ],
    redirectPaths: ["/api/connections/instagram/callback"],
    scopes: ["instagram_business_basic", "instagram_business_content_publish", "instagram_business_manage_insights"],
  },
  threads: {
    label: "Threads",
    covers: "Powers the Threads connection.",
    docsHint: "A separate Meta app registration from the one above.",
    consoleLabel: "Meta for Developers",
    consoleUrl: "https://developers.facebook.com/apps",
    steps: [
      'Create a separate app at developers.facebook.com — this is not the same app as your Meta (Facebook/Instagram) one.',
      'Add the "Threads" use case / product to it.',
      "Add the redirect URI below to its OAuth settings.",
      "Copy the Threads App ID and App Secret (found on the Threads product's settings page, not the main app Basic Settings).",
    ],
    stepsZh: [
      "在 developers.facebook.com 另外建立一個應用程式——這與你的 Meta（Facebook/Instagram）應用程式不是同一個。",
      "為它加入「Threads」使用案例／產品功能。",
      "在其 OAuth 設定中加入下方的重新導向 URI。",
      "複製 Threads 應用程式編號和密鑰（在 Threads 產品的設定頁面中可以找到，不是主應用程式的基本資料頁）。",
    ],
    redirectPaths: ["/api/connections/threads/callback"],
    scopes: ["threads_basic", "threads_content_publish"],
  },
  x: {
    label: "X (Twitter)",
    covers: "Powers the X connection.",
    docsHint: "Requires a paid API tier for write access at any real volume.",
    consoleLabel: "X Developer Portal",
    consoleUrl: "https://developer.twitter.com/en/portal/dashboard",
    steps: [
      "Sign up for a developer account and create a Project + App in the X Developer Portal.",
      'In the app\'s "User authentication settings", enable OAuth 2.0, set App type to "Web App", and set the callback URI below.',
      "Copy the Client ID and Client Secret from the app's OAuth 2.0 settings (under Keys and tokens).",
      "Note: posting at any real volume requires a paid API tier — the free tier is read-heavy and very limited for writes.",
    ],
    stepsZh: [
      "註冊開發者帳號，並在 X Developer Portal 中建立一個 Project 和 App。",
      "在該 App 的「User authentication settings」中，啟用 OAuth 2.0，將 App type 設為「Web App」，並設定下方的回呼（callback）URI。",
      "從該 App 的 OAuth 2.0 設定中複製用戶端 ID 和用戶端密鑰（在 Keys and tokens 頁籤下）。",
      "注意：要有實際可用的發文量，需要付費 API 方案——免費方案主要用於讀取，寫入（發文）額度非常有限。",
    ],
    redirectPaths: ["/api/connections/x/callback"],
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
  },
};

const APP_BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const ctx = await requireTenantContext();

  const credentials = await prisma.platformAppCredential.findMany({
    where: { organizationId: ctx.organizationId },
  });
  const credentialByProvider = new Map(credentials.map((c) => [c.provider, c]));

  async function saveCredential(formData: FormData) {
    "use server";
    const ctx = await requireTenantContext();

    const provider = formData.get("provider") as OAuthProvider;
    const clientId = (formData.get("clientId") as string)?.trim();
    const clientSecret = (formData.get("clientSecret") as string)?.trim();

    if (!OAUTH_PROVIDERS.includes(provider) || !clientId) {
      revalidatePath("/dashboard/settings");
      return;
    }

    const existing = await prisma.platformAppCredential.findUnique({
      where: { organizationId_provider: { organizationId: ctx.organizationId, provider } },
    });

    await prisma.platformAppCredential.upsert({
      where: { organizationId_provider: { organizationId: ctx.organizationId, provider } },
      create: {
        organizationId: ctx.organizationId,
        provider,
        clientId,
        encryptedClientSecret: encryptSecret(clientSecret || ""),
      },
      update: {
        clientId,
        // Leave the existing secret in place if the field was left blank on an update.
        encryptedClientSecret: clientSecret ? encryptSecret(clientSecret) : existing!.encryptedClientSecret,
      },
    });

    revalidatePath("/dashboard/settings");
  }

  async function removeCredential(formData: FormData) {
    "use server";
    const ctx = await requireTenantContext();
    const provider = formData.get("provider") as OAuthProvider;
    if (!OAUTH_PROVIDERS.includes(provider)) return;

    await prisma.platformAppCredential.deleteMany({
      where: { organizationId: ctx.organizationId, provider },
    });
    revalidatePath("/dashboard/settings");
  }

  return (
    <div className="max-w-2xl p-8">
      <h1 className="text-lg font-semibold text-neutral-900">Platform apps</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Add your own OAuth app credentials for each provider. These are stored per-workspace and used to connect
        your social accounts &mdash; nothing is read from server configuration.
      </p>

      {saved && (
        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          Saved.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error === "missing_credentials"
            ? "Add a Client ID and Client Secret below before connecting that platform."
            : error}
        </p>
      )}

      <div className="mt-6 space-y-4">
        {OAUTH_PROVIDERS.map((provider) => {
          const info = PROVIDER_INFO[provider];
          const existing = credentialByProvider.get(provider);

          return (
            <div key={provider} className="rounded-2xl border border-neutral-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{info.label}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">{info.covers}</p>
                </div>
                {existing && (
                  <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                    Configured
                  </span>
                )}
              </div>

              <form action={saveCredential} className="mt-4 space-y-3">
                <input type="hidden" name="provider" value={provider} />
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-700">Client ID</label>
                  <input
                    name="clientId"
                    type="text"
                    required
                    defaultValue={existing?.clientId ?? ""}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-700">Client secret</label>
                  <input
                    name="clientSecret"
                    type="password"
                    autoComplete="off"
                    placeholder={existing ? "•••••••• (leave blank to keep current)" : ""}
                    required={!existing}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>
                <p className="text-xs text-neutral-400">{info.docsHint}</p>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="submit"
                    className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-violet-700"
                  >
                    Save
                  </button>
                  {existing && (
                    <button
                      type="submit"
                      formAction={removeCredential}
                      className="text-sm font-medium text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </form>

              <details className="mt-4 border-t border-neutral-100 pt-3">
                <summary className="cursor-pointer text-xs font-medium text-violet-600 hover:text-violet-700">
                  How to get these
                </summary>
                <div className="mt-3 space-y-3">
                  <a
                    href={info.consoleUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-xs font-medium text-violet-600 underline hover:text-violet-700"
                  >
                    Open {info.consoleLabel} →
                  </a>

                  <ol className="list-decimal space-y-2.5 pl-4 text-xs text-neutral-600">
                    {info.steps.map((step, i) => (
                      <li key={i}>
                        {step}
                        {info.stepsZh[i] && <span className="mt-0.5 block text-neutral-400">{info.stepsZh[i]}</span>}
                      </li>
                    ))}
                  </ol>

                  <div>
                    <p className="text-xs font-medium text-neutral-700">
                      Redirect URI{info.redirectPaths.length > 1 ? "s" : ""} to register
                    </p>
                    <div className="mt-1 space-y-1">
                      {info.redirectPaths.map((path) => (
                        <code
                          key={path}
                          className="block rounded-md bg-neutral-100 px-2 py-1 text-xs text-neutral-700 select-all"
                        >
                          {APP_BASE_URL}
                          {path}
                        </code>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-neutral-700">Scopes this app requests</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {info.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </details>
            </div>
          );
        })}
      </div>
    </div>
  );
}
