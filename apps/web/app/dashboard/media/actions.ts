"use server";

import { randomUUID } from "node:crypto";
import { prisma } from "@social-suite/db";
import { requireTenantContext } from "@/lib/tenant";
import { createPresignedUploadUrl, deleteStorageObject, isStorageConfigured } from "@/lib/storage";
import { revalidatePath } from "next/cache";

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

export async function presignMediaUpload(
  filename: string,
  contentType: string,
  fileSize: number,
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const ctx = await requireTenantContext();

  if (!isStorageConfigured()) {
    throw new Error("Media storage isn't configured yet — add STORAGE_* values to your environment.");
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
    throw new Error("File size is invalid or exceeds the 2GB limit.");
  }

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  const key = `${ctx.organizationId}/${randomUUID()}-${safeName}`;

  return createPresignedUploadUrl(key, contentType);
}

export async function confirmMediaUpload(input: {
  storageUrl: string;
  mimeType: string;
  fileSize: number;
}): Promise<void> {
  const ctx = await requireTenantContext();

  await prisma.mediaAsset.create({
    data: {
      organizationId: ctx.organizationId,
      uploadedByUserId: ctx.userId,
      storageUrl: input.storageUrl,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
    },
  });

  revalidatePath("/dashboard/media");
}

export async function deleteMediaAsset(formData: FormData): Promise<void> {
  const ctx = await requireTenantContext();
  const mediaAssetId = formData.get("mediaAssetId") as string;

  const asset = await prisma.mediaAsset.findFirst({
    where: { id: mediaAssetId, organizationId: ctx.organizationId },
  });
  if (!asset) return;

  await prisma.mediaAsset.delete({ where: { id: asset.id } });

  try {
    await deleteStorageObject(asset.storageUrl);
  } catch (err) {
    console.error("Failed to delete storage object", err);
  }

  revalidatePath("/dashboard/media");
}
