import { useId } from "react";
import type { Platform } from "@social-suite/core";
import { PLATFORM_ICONS } from "./platform-icons";

export function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  const { hex, path } = PLATFORM_ICONS[platform];
  const gradientId = `platform-${platform}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  if (platform === "instagram") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <defs>
          <radialGradient id={gradientId} cx="30%" cy="107%" r="150%">
            <stop offset="0%" stopColor="#feda75" />
            <stop offset="28%" stopColor="#fa7e1e" />
            <stop offset="52%" stopColor="#d62976" />
            <stop offset="78%" stopColor="#962fbf" />
            <stop offset="100%" stopColor="#4f5bd5" />
          </radialGradient>
        </defs>
        <path d={path} fill={`url(#${gradientId})`} fillRule="evenodd" />
      </svg>
    );
  }

  if (platform === "tiktok" || platform === "douyin") {
    return (
      <svg viewBox="-1.2 -1.2 26.4 26.4" className={className} aria-hidden="true">
        <path d={path} fill="#25F4EE" transform="translate(-0.7 0.45)" fillRule="evenodd" />
        <path d={path} fill="#FE2C55" transform="translate(0.7 -0.35)" fillRule="evenodd" />
        <path d={path} fill="#111111" fillRule="evenodd" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d={path} fill={`#${hex}`} fillRule="evenodd" />
    </svg>
  );
}
