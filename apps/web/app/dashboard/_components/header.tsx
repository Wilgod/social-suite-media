"use client";

import { usePathname } from "next/navigation";
import { BellIcon } from "./icons";

const TITLES: Record<string, string> = {
  "/dashboard": "Home",
  "/dashboard/connections": "Connections",
  "/dashboard/posts": "Posts",
  "/dashboard/media": "Media",
  "/dashboard/analytics": "Analytics",
  "/dashboard/settings": "Platform apps",
};

export function Header() {
  const pathname = usePathname();
  const title = TITLES[pathname] ?? "Dashboard";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-6">
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      <button
        type="button"
        title="Notifications"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
      >
        <BellIcon className="h-[18px] w-[18px]" />
      </button>
    </header>
  );
}
