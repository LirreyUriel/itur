import { prisma } from "@/lib/prisma";
import { NotesView } from "@/components/notes/notes-view";
import { toDocumentRecord } from "@/lib/types";

export default async function NotesPage() {
  const documents = await prisma.document.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return <NotesView documents={documents.map(toDocumentRecord)} />;
}
