import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import type { SortDir } from "@/lib/sort";
import { cn } from "@/lib/utils";

export function SortableHead({
  label,
  active,
  dir,
  onClick,
  className,
  align = "start",
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  className?: string;
  align?: "start" | "center";
}) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={cn(align === "center" && "text-center", className)}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 font-medium hover:text-foreground",
          align === "center" && "w-full justify-center",
        )}
      >
        {label}
        <Icon className={cn("size-3.5", active ? "opacity-80" : "opacity-40")} />
      </button>
    </TableHead>
  );
}
