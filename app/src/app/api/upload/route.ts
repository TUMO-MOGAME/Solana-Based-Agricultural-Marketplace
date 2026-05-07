import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/*  POST /api/upload — accepts a single `file` multipart field, stores it on
    local disk under <repo>/tmp/uploads, and returns a media URL the coaching
    agent can fetch via `/api/media/<id>`. This is the dev path — swap for
    S3 / Supabase Storage before production deploys. */

// Keep uploads modest so a naive submit doesn't DOS the dev disk / memory.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
]);

function mediaKind(mime: string): "image" | "video" | null {
  if (ALLOWED_IMAGE_TYPES.has(mime)) return "image";
  if (ALLOWED_VIDEO_TYPES.has(mime)) return "video";
  return null;
}

// Pick a safe extension — trust the MIME type, not the filename
function extFor(kind: "image" | "video", mime: string): string {
  if (kind === "image") {
    if (mime === "image/jpeg") return "jpg";
    if (mime === "image/png") return "png";
    if (mime === "image/gif") return "gif";
    if (mime === "image/webp") return "webp";
  }
  if (mime === "video/mp4") return "mp4";
  if (mime === "video/quicktime") return "mov";
  if (mime === "video/webm") return "webm";
  if (mime === "video/x-matroska") return "mkv";
  return "bin";
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing `file` field" }, { status: 400 });
  }

  const kind = mediaKind(file.type);
  if (!kind) {
    return NextResponse.json(
      { error: `Unsupported type: ${file.type || "unknown"}` },
      { status: 415 }
    );
  }

  const limit = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (file.size > limit) {
    return NextResponse.json(
      {
        error: `${kind === "image" ? "Image" : "Video"} exceeds the ${
          limit / 1024 / 1024
        } MB limit.`,
      },
      { status: 413 }
    );
  }

  const dir = path.join(process.cwd(), "tmp", "uploads");
  await mkdir(dir, { recursive: true });

  const id = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const ext = extFor(kind, file.type);
  const filename = `${id}.${ext}`;
  const diskPath = path.join(dir, filename);

  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(diskPath, bytes);

  // Absolute URL so the coaching agent (running on its own port) can fetch it
  // from the Next.js server.
  const origin = req.nextUrl.origin;
  const url = `${origin}/api/media/${filename}`;

  // Return `storedName` so the caller can tell /api/coach-chat which file
  // to delete once the coaching agent finishes analysing it. Files live on
  // disk only for the duration of a single coaching turn.
  return NextResponse.json({
    url,
    kind,
    filename: file.name,
    storedName: filename,
    size: file.size,
    mime: file.type,
  });
}
