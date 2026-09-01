import { Badge } from "@/components/ui/badge";
import { normalizeEventStatus, type EventStatus, type TaskStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

const eventStatusClass: Record<EventStatus, string> = {
  אושר: "border-emerald-200 bg-emerald-50 text-emerald-800",
  בתהליך: "border-amber-200 bg-amber-50 text-amber-800",
  נדחה: "border-rose-200 bg-rose-50 text-rose-800",
  "לא ביקשתי": "border-slate-200 bg-slate-50 text-slate-700",
};

const taskStatusClass: Record<TaskStatus, string> = {
  לביצוע: "border-sky-200 bg-sky-50 text-sky-800",
  בטיפול: "border-amber-200 bg-amber-50 text-amber-800",
  בוצע: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

export function EventStatusBadge({ status }: { status: string }) {
  const normalized = normalizeEventStatus(status) ?? status;
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        eventStatusClass[normalized as EventStatus] ?? "bg-muted",
      )}
    >
      {normalized}
    </Badge>
  );
}

export function TaskStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", taskStatusClass[status as TaskStatus] ?? "bg-muted")}
    >
      {status}
    </Badge>
  );
}
