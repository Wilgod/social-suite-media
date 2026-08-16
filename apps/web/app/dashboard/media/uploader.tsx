"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { presignMediaUpload, confirmMediaUpload } from "./actions";

export function Uploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        const contentType = file.type || "application/octet-stream";
        const { uploadUrl, publicUrl } = await presignMediaUpload(file.name, contentType, file.size);

        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: file,
        });
        if (!putRes.ok) {
          throw new Error(`Upload failed (${putRes.status})`);
        }

        await confirmMediaUpload({ storageUrl: publicUrl, mimeType: contentType, fileSize: file.size });
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700 has-disabled:cursor-not-allowed has-disabled:opacity-50">
        {uploading ? "Uploading…" : "Upload media"}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          disabled={uploading}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
