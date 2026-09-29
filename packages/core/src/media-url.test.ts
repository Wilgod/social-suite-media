import assert from "node:assert/strict";
import { test } from "node:test";
import { metaMediaUrl, verifyMediaUrl } from "./media-url";

test("Meta local media URLs are public HTTPS and signature-limited", () => {
  const previous = process.env.TOKEN_ENCRYPTION_KEY;
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  try {
    const url = new URL(metaMediaUrl("https://localhost:3000/api/media/file/org/video.mp4", "https://example.ngrok-free.dev"));
    assert.equal(url.origin, "https://example.ngrok-free.dev");
    assert.equal(verifyMediaUrl("org/video.mp4", url.searchParams.get("expires"), url.searchParams.get("sig")), true);
    assert.equal(verifyMediaUrl("org/other.mp4", url.searchParams.get("expires"), url.searchParams.get("sig")), false);
    assert.equal(verifyMediaUrl("org/video.mp4", "1", url.searchParams.get("sig")), false);
    assert.throws(() => metaMediaUrl("https://localhost:3000/api/media/file/org/video.mp4", "https://localhost:3000"));
    assert.equal(metaMediaUrl("https://cdn.example.com/org/video.mp4", "https://example.ngrok-free.dev"), "https://cdn.example.com/org/video.mp4");
  } finally {
    if (previous === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
    else process.env.TOKEN_ENCRYPTION_KEY = previous;
  }
});
