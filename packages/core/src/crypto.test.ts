import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret } from "./crypto";

process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");

test("encryptSecret/decryptSecret round-trips", () => {
  const plaintext = "ya29.example-oauth-access-token";
  const encrypted = encryptSecret(plaintext);
  assert.notEqual(encrypted, plaintext);
  assert.equal(decryptSecret(encrypted), plaintext);
});

test("decryptSecret rejects tampered payloads", () => {
  const encrypted = encryptSecret("secret-value");
  const tamperedBytes = Buffer.from(encrypted, "base64");
  tamperedBytes[tamperedBytes.length - 1] ^= 0xff;
  assert.throws(() => decryptSecret(tamperedBytes.toString("base64")));
});
