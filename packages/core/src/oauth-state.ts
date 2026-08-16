import { decryptSecret, encryptSecret } from "./crypto";
import type { Platform } from "./types";

export interface OAuthState {
  organizationId: string;
  userId: string;
  platform: Platform;
  nonce: string;
  expiresAt: number;
  /** X (Twitter) OAuth2 PKCE code_verifier, carried across the redirect. */
  pkceVerifier?: string;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;

/** Encrypted (not just signed) so the state param never leaks org/user IDs or the PKCE verifier in the URL. */
export function createOAuthState(payload: Omit<OAuthState, "expiresAt" | "nonce">, ttlMs = DEFAULT_TTL_MS): string {
  const state: OAuthState = {
    ...payload,
    nonce: Math.random().toString(36).slice(2),
    expiresAt: Date.now() + ttlMs,
  };
  return encryptSecret(JSON.stringify(state));
}

export function verifyOAuthState(token: string): OAuthState {
  const state = JSON.parse(decryptSecret(token)) as OAuthState;
  if (state.expiresAt < Date.now()) {
    throw new Error("OAuth state expired, please retry connecting the account");
  }
  return state;
}
