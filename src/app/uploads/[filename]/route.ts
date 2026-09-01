import { readFile } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, isSessionValid } from "@/lib/auth";
import { uploadsDir } from "@/lib/paths";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> },
) {
  if (!(await isSessionValid((await cookies()).get(SESSION_COOKIE)?.value))) {
    return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });
  }

  const { filename } = await context.params;
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return NextResponse.json({ error: "שם קובץ לא תקין" }, { status: 400 });
  }

  try {
    const filePath = path.join(uploadsDir(), filename);
    const data = await readFile(filePath);
    const type = TYPES[path.extname(filename).toLowerCase()] ?? "application/octet-stream";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "הקובץ לא נמצא" }, { status: 404 });
  }
}
