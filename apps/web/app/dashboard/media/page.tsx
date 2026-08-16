import { prisma } from "@social-suite/db";
import { requireTenantContext } from "@/lib/tenant";
import { isStorageConfigured } from "@/lib/storage";
import { Uploader } from "./uploader";
import { deleteMediaAsset } from "./actions";

export default async function MediaPage() {
  const ctx = await requireTenantContext();
  const storageConfigured = isStorageConfigured();

  const assets = storageConfigured
    ? await prisma.mediaAsset.findMany({
        where: { organizationId: ctx.organizationId },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="max-w-4xl p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Media</h1>
          <p className="mt-1 text-sm text-neutral-500">Images and videos available to attach to posts.</p>
        </div>
        {storageConfigured && <Uploader />}
      </div>

      {!storageConfigured && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <p className="text-sm font-medium text-amber-800">Media storage isn't configured yet.</p>
          <p className="mt-1 text-sm text-amber-700">
            Set <code className="rounded bg-amber-100 px-1 py-0.5">STORAGE_ENDPOINT</code>,{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5">STORAGE_BUCKET</code>,{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5">STORAGE_ACCESS_KEY_ID</code>,{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5">STORAGE_SECRET_ACCESS_KEY</code>, and{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5">STORAGE_PUBLIC_BASE_URL</code> in your environment
            (any S3-compatible provider — Cloudflare R2, AWS S3, MinIO, etc.), then restart the app.
          </p>
        </div>
      )}

      {storageConfigured && assets.length === 0 && (
        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-8 text-center">
          <p className="text-sm text-neutral-500">No media uploaded yet.</p>
        </div>
      )}

      {assets.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {assets.map((asset) => (
            <div key={asset.id} className="group relative rounded-lg border border-neutral-100 p-2">
              {asset.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={asset.storageUrl} alt="" className="aspect-square w-full rounded-md object-cover" />
              ) : asset.mimeType.startsWith("video/") ? (
                <video src={asset.storageUrl} muted className="aspect-square w-full rounded-md bg-black object-cover" />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center rounded-md bg-neutral-100 text-xs text-neutral-400">
                  {asset.mimeType}
                </div>
              )}
              <p className="mt-2 truncate text-[11px] text-neutral-500">{formatBytes(asset.fileSize)}</p>

              <form action={deleteMediaAsset} className="absolute top-3 right-3 opacity-0 transition group-hover:opacity-100">
                <input type="hidden" name="mediaAssetId" value={asset.id} />
                <button
                  type="submit"
                  title="Delete"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-neutral-500 shadow-sm hover:bg-red-50 hover:text-red-600"
                >
                  ×
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}
