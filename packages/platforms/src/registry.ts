import type { Platform, PlatformAdapter } from "@social-suite/core";

/**
 * One entry per platform, filled in as each adapter is implemented.
 * Both the web app's OAuth connect/callback routes and the worker's
 * publish job resolve adapters through this registry rather than
 * importing a specific platform module directly, so neither has to
 * know about platforms it isn't currently handling.
 */
const registry = new Map<Platform, PlatformAdapter>();

export function registerAdapter(adapter: PlatformAdapter): void {
  registry.set(adapter.platform, adapter);
}

export function getAdapter(platform: Platform): PlatformAdapter {
  const adapter = registry.get(platform);
  if (!adapter) {
    throw new Error(`No PlatformAdapter registered for platform "${platform}"`);
  }
  return adapter;
}

export function hasAdapter(platform: Platform): boolean {
  return registry.has(platform);
}
