import assert from "node:assert/strict";
import { test } from "node:test";
import { facebookAdapter } from "./facebook";
import { instagramAdapter } from "./instagram";
import { threadsAdapter } from "./threads";

const credentials = { accessToken: "sample-access-token" };

test("Facebook connection requires a Page token and never exposes it in metadata", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ data: [{ id: "page-1", name: "Test Page", access_token: "sample-page-token" }] });
  try {
    const identity = await facebookAdapter.fetchAccountIdentity("sample-user-token");
    assert.ok(Array.isArray(identity));
    assert.equal(identity[0].accessToken, "sample-page-token");
    assert.deepEqual(identity[0].metadata, { pageId: "page-1" });
  } finally { globalThis.fetch = original; }
});

test("Facebook text and image publish select their respective Page endpoints", async () => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    return Response.json({ id: `post-${calls.length}` });
  };
  try {
    const base = { postTargetId: "target-1", externalAccountId: "page-1", content: "hello" };
    assert.equal((await facebookAdapter.publish({ ...base, media: [] }, credentials)).success, true);
    assert.equal((await facebookAdapter.publish({ ...base, media: [{ url: "https://cdn.example.com/a.jpg", mimeType: "image/jpeg", order: 0 }] }, credentials)).success, true);
    assert.match(calls[0], /\/page-1\/feed$/);
    assert.match(calls[1], /\/page-1\/photos$/);
  } finally { globalThis.fetch = original; }
});

test("Instagram waits for video processing before confirming publish", async () => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/ig-1/media")) return Response.json({ id: "container-1" });
    if (url.includes("/container-1")) return Response.json({ status_code: "FINISHED" });
    if (url.endsWith("/ig-1/media_publish")) return Response.json({ id: "ig-post-1" });
    throw new Error(`Unexpected request ${url}`);
  };
  try {
    const result = await instagramAdapter.publish({ postTargetId: "target-2", externalAccountId: "ig-1", content: "caption", media: [{ url: "https://cdn.example.com/a.mp4", mimeType: "video/mp4", order: 0 }] }, credentials);
    assert.equal(result.success, true);
    assert.equal(result.externalPostId, "ig-post-1");
    assert.equal(calls.length, 3);
  } finally { globalThis.fetch = original; }
});

test("Threads text publish creates and publishes a container", async () => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    return Response.json(url.endsWith("/threads_publish") ? { id: "thread-1" } : { id: "container-1" });
  };
  try {
    const result = await threadsAdapter.publish({ postTargetId: "target-3", externalAccountId: "threads-1", content: "hello", media: [] }, credentials);
    assert.equal(result.success, true);
    assert.equal(result.externalPostId, "thread-1");
    assert.equal(calls.length, 2);
  } finally { globalThis.fetch = original; }
});

test("Meta adapters reject extra attachments instead of silently dropping them", async () => {
  const target = { postTargetId: "target-4", externalAccountId: "account-1", content: "hello", media: [
    { url: "https://cdn.example.com/a.jpg", mimeType: "image/jpeg", order: 0 },
    { url: "https://cdn.example.com/b.jpg", mimeType: "image/jpeg", order: 1 },
  ] };
  for (const adapter of [facebookAdapter, instagramAdapter, threadsAdapter]) {
    const result = await adapter.publish(target, credentials);
    assert.equal(result.success, false);
    assert.equal(result.errorCode, "unsupported_media_count");
  }
});
