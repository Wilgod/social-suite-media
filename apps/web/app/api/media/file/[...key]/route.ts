import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { localFilePath } from "@/lib/storage";
import { verifyMediaUrl } from "@social-suite/core";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const joined = key.join("/");
  if (!joined || joined.includes("..")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const query = request.nextUrl.searchParams;
  const signed = query.has("expires") || query.has("sig");
  if (signed) {
    if (!verifyMediaUrl(joined, query.get("expires"), query.get("sig"))) {
      return NextResponse.json({ error: "Invalid or expired media link" }, { status: 403 });
    }
  } else {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const filePath = localFilePath(joined);
  let fileSize: number;
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("not a file");
    fileSize = info.size;
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = joined.split(".").pop()?.toLowerCase();
  const type =
    ext === "mp4"
      ? "video/mp4"
      : ext === "mov"
        ? "video/quicktime"
        : ext === "webm"
          ? "video/webm"
          : ext === "png"
            ? "image/png"
            : ext === "jpg" || ext === "jpeg"
              ? "image/jpeg"
              : "application/octet-stream";

  const range = request.headers.get("range");
  if (range) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (!match) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }
    const start = Number(match[1]);
    const requestedEnd = match[2] ? Number(match[2]) : fileSize - 1;
    const end = Math.min(requestedEnd, fileSize - 1);
    if (start >= fileSize || end < start) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }
    const partial = Readable.toWeb(createReadStream(filePath, { start, end })) as unknown as ReadableStream;
    return new NextResponse(partial, {
      status: 206,
      headers: {
        "Content-Type": type,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": signed ? "public, max-age=3600" : "private, max-age=3600",
      },
    });
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as unknown as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(fileSize),
      "Accept-Ranges": "bytes",
      "Cache-Control": signed ? "public, max-age=3600" : "private, max-age=3600",
    },
  });
}
