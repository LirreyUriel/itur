import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { maybeBackup } from "@/lib/backup";
import { SESSION_COOKIE, isSessionValid } from "@/lib/auth";
import { uploadsDir } from "@/lib/paths";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export async function POST(request: Request) {
  if (!(await isSessionValid((await cookies()).get(SESSION_COOKIE)?.value))) {
    return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "לא נבחר קובץ" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "סוג קובץ לא נתמך" }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "הקובץ גדול מדי (עד 8MB)" }, { status: 400 });
  }

  const extension = path.extname(file.name).toLowerCase() || ".png";
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`;
  const directory = uploadsDir();
  await mkdir(directory, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(directory, safeName), buffer);
  maybeBackup(prisma);

  return NextResponse.json({ url: `/uploads/${safeName}` });
}
