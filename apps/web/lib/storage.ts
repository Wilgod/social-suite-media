import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";

interface StorageConfig {
  driver: "s3" | "local";
  endpoint?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicBaseUrl: string;
  localDir?: string;
}

function localDir() {
  return path.resolve(process.cwd(), "../../data/media");
}

function appBaseUrl() {
  return (process.env.NEXTAUTH_URL ?? "https://localhost:3000").replace(/\/$/, "");
}

function readConfig(): StorageConfig | null {
  if ((process.env.STORAGE_DRIVER ?? "").toLowerCase() === "local") {
    return {
      driver: "local",
      publicBaseUrl: `${appBaseUrl()}/api/media/file`,
      localDir: localDir(),
    };
  }

  const {
    STORAGE_ENDPOINT,
    STORAGE_BUCKET,
    STORAGE_ACCESS_KEY_ID,
    STORAGE_SECRET_ACCESS_KEY,
    STORAGE_PUBLIC_BASE_URL,
  } = process.env;

  if (
    !STORAGE_ENDPOINT ||
    !STORAGE_BUCKET ||
    !STORAGE_ACCESS_KEY_ID ||
    !STORAGE_SECRET_ACCESS_KEY ||
    !STORAGE_PUBLIC_BASE_URL
  ) {
    return null;
  }

  return {
    driver: "s3",
    endpoint: STORAGE_ENDPOINT,
    bucket: STORAGE_BUCKET,
    accessKeyId: STORAGE_ACCESS_KEY_ID,
    secretAccessKey: STORAGE_SECRET_ACCESS_KEY,
    publicBaseUrl: STORAGE_PUBLIC_BASE_URL,
  };
}

export function isStorageConfigured(): boolean {
  return readConfig() !== null;
}

export function getStorageConfig(): StorageConfig {
  const config = readConfig();
  if (!config) {
    throw new Error("Media storage is not configured (STORAGE_* env vars missing)");
  }
  return config;
}

let cached: { client: S3Client; config: StorageConfig } | undefined;

function getClient(): { client: S3Client; config: StorageConfig } {
  if (cached) return cached;
  const config = getStorageConfig();
  if (config.driver !== "s3") {
    throw new Error("S3 client requested for local storage");
  }
  const client = new S3Client({
    endpoint: config.endpoint,
    region: "auto",
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKeyId!, secretAccessKey: config.secretAccessKey! },
  });
  cached = { client, config };
  return cached;
}

export function localFilePath(key: string): string {
  const safe = key.replace(/\.\./g, "").replace(/^\/+/, "");
  return path.join(localDir(), safe);
}

/** Returns a short-lived URL the browser can PUT the file to directly, plus the public URL it'll live at. */
export async function createPresignedUploadUrl(
  key: string,
  contentType: string,
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const config = getStorageConfig();
  if (config.driver === "local") {
    await mkdir(path.dirname(localFilePath(key)), { recursive: true });
    const uploadUrl = `/api/media/upload?key=${encodeURIComponent(key)}&contentType=${encodeURIComponent(contentType)}`;
    const publicUrl = `${config.publicBaseUrl}/${key}`;
    return { uploadUrl, publicUrl };
  }

  const { client } = getClient();
  const command = new PutObjectCommand({ Bucket: config.bucket, Key: key, ContentType: contentType });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
  const publicUrl = `${config.publicBaseUrl.replace(/\/$/, "")}/${key}`;
  return { uploadUrl, publicUrl };
}

export async function deleteStorageObject(publicUrl: string): Promise<void> {
  const config = getStorageConfig();
  const prefix = `${config.publicBaseUrl.replace(/\/$/, "")}/`;
  const key = publicUrl.startsWith(prefix) ? publicUrl.slice(prefix.length) : publicUrl;

  if (config.driver === "local") {
    await unlink(localFilePath(key)).catch(() => undefined);
    return;
  }

  const { client } = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}
