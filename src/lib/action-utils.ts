import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { maybeBackup } from "@/lib/backup";

export function revalidateApp() {
  maybeBackup(prisma);
  revalidatePath("/", "layout");
}

export type ActionResult = {
  ok: boolean;
  error?: string;
  id?: string;
};
