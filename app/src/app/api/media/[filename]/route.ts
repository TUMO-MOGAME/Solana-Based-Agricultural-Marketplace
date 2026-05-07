import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

/*  GET /api/media/<filename> — serve uploaded files back to the Gemini /
    coaching agent (which fetches them via HTTP). Scoped to the single
    `tmp/uploads` directory — rejects anything that tries to walk out with
    path separators. Read-only. */

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Reject traversal attempts and empty names before touching the disk.
  if (!filename || filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const dir = path.join(process.cwd(), "tmp", "uploads");
  const diskPath = path.join(dir, filename);

  // Belt-and-braces: ensure the resolved path still lives under the uploads dir.
  const resolvedDir = path.resolve(dir);
  const resolvedFile = path.resolve(diskPath);
  if (!resolvedFile.startsWith(resolvedDir + path.sep)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  let bytes: Buffer;
  try {
    bytes = await readFile(resolvedFile);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = (filename.split(".").pop() ?? "").toLowerCase();
  const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": bytes.length.toString(),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
