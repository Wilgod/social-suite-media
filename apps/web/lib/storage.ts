import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

interface StorageConfig {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
}

function readConfig(): StorageConfig | null {
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

let cached: { client: S3Client; config: StorageConfig } | undefined;

function getClient(): { client: S3Client; config: StorageConfig } {
  if (cached) return cached;

  const config = readConfig();
  if (!config) {
    throw new Error("Media storage is not configured (STORAGE_* env vars missing)");
  }

  const client = new S3Client({
    endpoint: config.endpoint,
    region: "auto",
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });

  cached = { client, config };
  return cached;
}

/** Returns a short-lived URL the browser can PUT the file to directly, plus the public URL it'll live at. */
export async function createPresignedUploadUrl(
  key: string,
  contentType: string,
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const { client, config } = getClient();
  const command = new PutObjectCommand({ Bucket: config.bucket, Key: key, ContentType: contentType });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
  const publicUrl = `${config.publicBaseUrl.replace(/\/$/, "")}/${key}`;
  return { uploadUrl, publicUrl };
}

export async function deleteStorageObject(publicUrl: string): Promise<void> {
  const { client, config } = getClient();
  const prefix = `${config.publicBaseUrl.replace(/\/$/, "")}/`;
  const key = publicUrl.startsWith(prefix) ? publicUrl.slice(prefix.length) : publicUrl;
  await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}
