import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-violet-500 text-sm font-bold text-white">
            S
          </span>
          <span className="text-lg font-semibold text-neutral-900">Social Suite Media</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/terms" className="text-neutral-600 hover:text-neutral-900">
            Terms
          </Link>
          <Link href="/privacy" className="text-neutral-600 hover:text-neutral-900">
            Privacy
          </Link>
          <Link href="/login" className="text-neutral-600 hover:text-neutral-900">
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-violet-600 px-3 py-1.5 font-medium text-white hover:bg-violet-700"
          >
            Sign up
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-6 text-sm text-neutral-600 sm:flex-row sm:items-center sm:justify-between">
        <p>Social Suite Media · operated by Brilliant Solutions</p>
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/terms" className="hover:text-neutral-900">
            Terms of Service
          </Link>
          <Link href="/privacy" className="hover:text-neutral-900">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-neutral-900">
            服务条款
          </Link>
          <Link href="/privacy" className="hover:text-neutral-900">
            隐私政策
          </Link>
          <a href="mailto:jessie.lung@bsoltec.com" className="hover:text-neutral-900">
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
