import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · Social Suite Media",
  description: "Privacy Policy for Social Suite Media, including TikTok data use.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold text-neutral-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-neutral-500">Last updated: 18 September 2026</p>
      <p className="mt-2 text-sm text-neutral-500">隐私政策 · Social Suite Media</p>

      <div className="mt-8 space-y-6 text-[15px] leading-7 text-neutral-700">
        <p>
          This Privacy Policy explains how Social Suite Media collects, uses, and stores information
          when you use our publishing and analytics product, including when you connect a TikTok
          account.
        </p>
        <p>
          本隐私政策说明 Social Suite Media 在提供发布与数据分析服务时如何收集、使用和存储信息，包括你连接 TikTok 账号时的情况。
        </p>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">1. Information we collect / 我们收集的信息</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>
              <strong>Account information:</strong> name, email, and organization details you provide
              at signup.
            </li>
            <li>
              <strong>Connected platform data:</strong> OAuth tokens, account IDs, profile names, and
              public video metrics such as views, likes, comments, shares, and saves, retrieved
              through official APIs.
            </li>
            <li>
              <strong>Content you upload:</strong> videos, captions, and scheduling data needed to
              publish on your behalf.
            </li>
            <li>
              <strong>Usage data:</strong> product logs needed to operate, debug, and secure the
              service.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">2. How we use information / 使用方式</h2>
          <p className="mt-2">
            We use this information to authenticate you, connect social accounts, publish content you
            request, display analytics, provide support, and improve reliability. We do not sell
            personal data.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">3. TikTok data / TikTok 数据</h2>
          <p className="mt-2">
            If you connect TikTok, we receive only the scopes you approve, such as basic profile
            information, video listing, and publishing. TikTok tokens are stored to keep the
            connection active and to refresh metrics. You can disconnect TikTok at any time in Social
            Suite Media settings, which stops future API calls.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">4. Sharing / 共享</h2>
          <p className="mt-2">
            We share data with the social platforms you choose to connect, and with infrastructure
            providers that host the product, only as needed to run the service. We do not share your
            content or analytics with unrelated third parties for advertising.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">5. Retention / 保存期限</h2>
          <p className="mt-2">
            We keep account, token, and analytics data while your organization uses the service, and
            for a limited period afterward as needed for security, backups, and legal obligations.
            You may request deletion by contacting us.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">6. Security / 安全</h2>
          <p className="mt-2">
            Access tokens and credentials are stored with restricted access. No method of
            transmission or storage is 100% secure.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">7. Your choices / 你的选择</h2>
          <p className="mt-2">
            You may access, update, or delete organization data, disconnect platforms, or request
            export/deletion by emailing us. Disconnecting a platform does not automatically delete
            historical posts already published on that platform.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">8. Children / 儿童</h2>
          <p className="mt-2">
            The service is intended for business users and is not directed to children under 13.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">9. Contact / 联系</h2>
          <p className="mt-2">
            Privacy questions or deletion requests:{" "}
            <a className="text-violet-600 hover:text-violet-700" href="mailto:jessie.lung@bsoltec.com">
              jessie.lung@bsoltec.com
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
