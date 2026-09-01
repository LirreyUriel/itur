import { prisma } from "@/lib/prisma";
import { NotesView } from "@/components/notes/notes-view";
import { toDocumentRecord } from "@/lib/types";

export default async function NotesPage() {
  const [folders, documents] = await Promise.all([
    prisma.folder.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, sortOrder: true },
    }),
    prisma.document.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return (
    <NotesView
      folders={folders}
      documents={documents.map(toDocumentRecord)}
    />
  );
}
