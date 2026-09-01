import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { maybeBackup } from "@/lib/backup";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    id?: string;
    title?: string;
    content?: string;
  } | null;

  if (!body?.id) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const existing = await prisma.document.findUnique({ where: { id: body.id } });
  if (!existing) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  await prisma.document.update({
    where: { id: body.id },
    data: {
      title: (body.title ?? "").trim() || existing.title || "מסמך חדש",
      content: body.content ?? existing.content,
    },
  });
  maybeBackup(prisma);

  return NextResponse.json({ ok: true });
}
