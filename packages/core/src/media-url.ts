import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_LIFETIME_SECONDS = 24 * 60 * 60;

function signingKey(): Buffer {
  const encoded = process.env.TOKEN_ENCRYPTION_KEY;
  if (!encoded) throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must decode to 32 bytes");
  return key;
}

function signature(key: string, expires: number): string {
  return createHmac("sha256", signingKey()).update(`meta-media\n${key}\n${expires}`).digest("base64url");
}

export function signMediaUrl(key: string, expires: number): string {
  return signature(key, expires);
}

export function verifyMediaUrl(key: string, expiresRaw: string | null, sig: string | null): boolean {
  const expires = Number(expiresRaw);
  const now = Math.floor(Date.now() / 1000);
  if (!key || !Number.isSafeInteger(expires) || expires <= now || expires > now + MAX_LIFETIME_SECONDS || !sig) return false;
  const expected = Buffer.from(signature(key, expires));
  const supplied = Buffer.from(sig);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

/** Creates a short-lived public URL exclusively for Meta to download local media. */
export function metaMediaUrl(storageUrl: string, publicBaseUrl: string): string {
  const source = new URL(storageUrl);
  const marker = "/api/media/file/";
  if (!source.pathname.startsWith(marker)) return storageUrl; // S3/R2 is already public.

  const publicBase = new URL(publicBaseUrl);
  if (publicBase.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(publicBase.hostname)) {
    throw new Error("Meta media publishing requires a public HTTPS OAUTH_PUBLIC_BASE_URL or public S3/R2 storage");
  }
  const key = decodeURIComponent(source.pathname.slice(marker.length));
  const expires = Math.floor(Date.now() / 1000) + MAX_LIFETIME_SECONDS;
  const url = new URL(source.pathname, publicBase);
  url.searchParams.set("expires", String(expires));
  url.searchParams.set("sig", signMediaUrl(key, expires));
  return url.toString();
}
