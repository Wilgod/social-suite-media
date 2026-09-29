import Link from "next/link";

export default function HomePage() {
  return (
    <main className="bg-white">
      <section className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-sm font-medium text-violet-600">Social publishing and analytics</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-neutral-900">
          Connect official accounts, publish videos, and track public performance.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-neutral-600">
          Social Suite Media is a workspace for teams that manage social video. Connect TikTok and
          other official platform accounts, publish content you own, and review public metrics such
          as views, likes, comments, and shares.
        </p>
        <p className="mt-3 max-w-2xl text-neutral-600">
          连接官方社交账号、发布视频，并查看播放、点赞、评论和分享等公开数据。
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700"
          >
            Create workspace
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
          >
            Log in
          </Link>
        </div>
      </section>

      <section className="border-y border-neutral-200 bg-neutral-50">
        <div className="mx-auto grid max-w-5xl gap-6 px-6 py-12 sm:grid-cols-3">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Official connections</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Sign in with official OAuth. For TikTok this uses Login Kit, then only the scopes you
              approve: basic profile, video list, and publishing.
            </p>
          </div>
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Video publishing</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Upload or schedule videos from your workspace. Content is sent through official APIs
              at your request. You keep ownership of your media.
            </p>
          </div>
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Public metrics</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Refresh views, likes, comments, shares, and related public stats so teams can see how
              published videos are performing.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-xl font-semibold text-neutral-900">How TikTok integration works</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-neutral-600">
          <li>A workspace admin connects a TikTok account they are authorized to operate.</li>
          <li>TikTok asks the account owner to approve requested scopes.</li>
          <li>The workspace can list authorized videos, publish approved content, and read public metrics.</li>
          <li>The account can be disconnected at any time in Settings, which stops future API calls.</li>
        </ol>
        <p className="mt-6 text-sm text-neutral-500">
          Legal:{" "}
          <Link href="/terms" className="text-violet-600 hover:text-violet-700">
            Terms of Service
          </Link>
          {" · "}
          <Link href="/privacy" className="text-violet-600 hover:text-violet-700">
            Privacy Policy
          </Link>
          {" · "}
          <Link href="/terms" className="text-violet-600 hover:text-violet-700">
            服务条款
          </Link>
          {" · "}
          <Link href="/privacy" className="text-violet-600 hover:text-violet-700">
            隐私政策
          </Link>
        </p>
      </section>
    </main>
  );
}
