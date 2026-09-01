import { Badge } from "@/components/ui/badge";
import { EVENT_STATUS_LABELS, type EventStatus, type TaskStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

const eventStatusClass: Record<EventStatus, string> = {
  Approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
  "In Process": "border-amber-200 bg-amber-50 text-amber-800",
  Denied: "border-rose-200 bg-rose-50 text-rose-800",
  "To be done (TBD)": "border-slate-200 bg-slate-50 text-slate-700",
};

const taskStatusClass: Record<TaskStatus, string> = {
  לביצוע: "border-sky-200 bg-sky-50 text-sky-800",
  בטיפול: "border-amber-200 bg-amber-50 text-amber-800",
  בוצע: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

export function EventStatusBadge({ status }: { status: string }) {
  const label = EVENT_STATUS_LABELS[status as EventStatus] ?? status;
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", eventStatusClass[status as EventStatus] ?? "bg-muted")}
    >
      {label}
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
