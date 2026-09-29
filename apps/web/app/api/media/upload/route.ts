import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStorageConfig, localFilePath } from "@/lib/storage";

export const runtime = "nodejs";

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = getStorageConfig();
  if (config.driver !== "local") {
    return NextResponse.json({ error: "Local upload is not enabled" }, { status: 400 });
  }

  const key = request.nextUrl.searchParams.get("key");
  if (!key || key.includes("..")) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  const filePath = localFilePath(key);
  await mkdir(path.dirname(filePath), { recursive: true });
  const bytes = Buffer.from(await request.arrayBuffer());
  await writeFile(filePath, bytes);
  return new NextResponse(null, { status: 204 });
}
