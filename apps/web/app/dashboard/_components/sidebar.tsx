"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  LinkIcon,
  QueueIcon,
  MediaIcon,
  AnalyticsIcon,
  SettingsIcon,
  LogOutIcon,
} from "./icons";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: HomeIcon, exact: true },
  { href: "/dashboard/connections", label: "Connections", icon: LinkIcon },
  { href: "/dashboard/posts", label: "Posts", icon: QueueIcon },
  { href: "/dashboard/media", label: "Media", icon: MediaIcon },
  { href: "/dashboard/analytics", label: "Analytics", icon: AnalyticsIcon },
];

const WORKSPACE_ITEMS = [
  { href: "/dashboard/settings", label: "Settings", icon: SettingsIcon },
];

export function Sidebar({
  userEmail,
  organizationName,
  role,
  signOutAction,
}: {
  userEmail: string;
  organizationName: string;
  role?: string;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-neutral-200 bg-white">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-violet-500 text-sm font-bold text-white">
          S
        </span>
        <span className="text-base font-semibold text-neutral-900">Social Suite</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} pathname={pathname} {...item} />
        ))}

        <p className="mt-6 mb-1 px-3 text-xs font-medium tracking-wide text-neutral-400 uppercase">
          Workspace
        </p>
        {WORKSPACE_ITEMS.map((item) => (
          <NavLink key={item.href} pathname={pathname} {...item} />
        ))}
      </nav>

      <div className="border-t border-neutral-200 p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-medium text-violet-700">
            {userEmail.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-neutral-900">{organizationName}</p>
            <p className="truncate text-xs text-neutral-500">
              {userEmail}
              {role ? ` · ${role}` : ""}
            </p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              title="Sign out"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
            >
              <LogOutIcon className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

function NavLink({
  pathname,
  href,
  label,
  icon: Icon,
  exact,
  soon,
}: {
  pathname: string;
  href: string;
  label: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactElement;
  exact?: boolean;
  soon?: boolean;
}) {
  const active = exact ? pathname === href : pathname.startsWith(href);

  if (soon) {
    return (
      <span className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2 text-sm text-neutral-400">
        <span className="flex items-center gap-2.5">
          <Icon className="h-[18px] w-[18px]" />
          {label}
        </span>
        <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-neutral-400 uppercase">
          Soon
        </span>
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-violet-50 text-violet-700"
          : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
      }`}
    >
      <Icon className="h-[18px] w-[18px]" />
      {label}
    </Link>
  );
}
