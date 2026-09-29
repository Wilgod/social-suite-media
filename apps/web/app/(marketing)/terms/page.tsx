import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service · Social Suite Media",
  description: "Terms of Service for Social Suite Media.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold text-neutral-900">Terms of Service</h1>
      <p className="mt-2 text-sm text-neutral-500">Last updated: 18 September 2026</p>
      <p className="mt-2 text-sm text-neutral-500">服务条款 · Social Suite Media</p>

      <div className="mt-8 space-y-6 text-[15px] leading-7 text-neutral-700">
        <p>
          These Terms of Service (“Terms”) govern your use of Social Suite Media, a social publishing
          and analytics product that lets teams connect social accounts, publish videos, and view
          public performance metrics.
        </p>
        <p>
          本服务条款（“条款”）适用于 Social Suite Media。该产品帮助团队连接官方社交账号、发布视频，并查看公开表现数据。
        </p>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">1. The service / 服务内容</h2>
          <p className="mt-2">
            Social Suite Media helps organizations connect official platform accounts (including
            TikTok), schedule or publish video content, and collect publicly available metrics such as
            views, likes, comments, and shares. You must have the right to operate each connected
            account.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">2. Accounts and access / 账号与权限</h2>
          <p className="mt-2">
            You are responsible for the accuracy of information you provide, for keeping login
            credentials secure, and for all activity under your organization. You must be authorized
            by your company to connect social accounts and to publish content.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">3. Platform rules / 平台规则</h2>
          <p className="mt-2">
            When you connect TikTok or any other platform, you also agree to that platform’s terms,
            developer policies, and community guidelines. We only use official APIs. We do not
            support unofficial scraping, credential sharing, or circumventing platform security.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">4. Content / 内容</h2>
          <p className="mt-2">
            You retain ownership of content you upload or publish. You grant us a limited license to
            process, transmit, and store that content solely to provide the service, including
            sending it to connected platforms at your request.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">5. Acceptable use / 使用规范</h2>
          <p className="mt-2">
            You may not use the service to publish illegal, infringing, deceptive, or harmful
            content; spam; or content that violates TikTok or other platform policies. We may suspend
            access if we reasonably believe these Terms are being violated.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">6. Availability / 可用性</h2>
          <p className="mt-2">
            The service is provided as-is. Platform APIs, reviews, and rate limits are outside our
            control. We do not guarantee uninterrupted publishing or complete metrics.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">7. Liability / 责任限制</h2>
          <p className="mt-2">
            To the maximum extent permitted by law, Social Suite Media and its operators are not
            liable for indirect, incidental, or consequential damages, or for losses caused by
            third-party platforms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">8. Changes / 变更</h2>
          <p className="mt-2">
            We may update these Terms. Continued use after an update constitutes acceptance of the
            revised Terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">9. Contact / 联系</h2>
          <p className="mt-2">
            Questions about these Terms:{" "}
            <a className="text-violet-600 hover:text-violet-700" href="mailto:jessie.lung@bsoltec.com">
              jessie.lung@bsoltec.com
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
