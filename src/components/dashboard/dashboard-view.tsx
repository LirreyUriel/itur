import Link from "next/link";
import {
  CalendarDays,
  CheckSquare,
  FileText,
  Users,
} from "lucide-react";
import { formatHebrewDate, formatHebrewShortDate, isUpcomingEvent } from "@/lib/dates";
import type { DocumentRecord, EvaluatorRecord, EventRecord, TaskRecord } from "@/lib/types";
import { EvaluatorChip } from "@/components/evaluator-chip";
import { PageHeader, Surface } from "@/components/page-header";
import { EventStatusBadge, TaskStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";

export function DashboardView({
  evaluators,
  events,
  tasks,
  documents,
}: {
  evaluators: EvaluatorRecord[];
  events: EventRecord[];
  tasks: TaskRecord[];
  documents: DocumentRecord[];
}) {
  const relevant = evaluators.filter((evaluator) => evaluator.relevantTo2026).length;
  const openTasks = tasks.filter((task) => task.status !== "בוצע").length;
  const externalEvents = events.filter((event) => !event.internal);
  const remainingExternal = externalEvents.filter((event) => isUpcomingEvent(event.date)).length;
  const upcoming = events.filter((event) => isUpcomingEvent(event.date)).slice(0, 4);
  const activeTasks = tasks.filter((task) => task.status !== "בוצע").slice(0, 4);

  const stats = [
    {
      label: "מעריכים בבנק",
      value: String(evaluators.length),
      hint: `${relevant} רלוונטיים ל-2026`,
      href: "/evaluators",
      icon: Users,
    },
    {
      label: "מיונים חיצוניים",
      value: `${remainingExternal}/${externalEvents.length}`,
      hint: "נשארו מתוך כלל המיונים שאינם פנימיים",
      href: "/events",
      icon: CalendarDays,
    },
    {
      label: "משימות פתוחות",
      value: String(openTasks),
      hint: `${tasks.length} בסך הכל`,
      href: "/tasks",
      icon: CheckSquare,
    },
    {
      label: "מסמכים",
      value: String(documents.length),
      hint: "טקסט חופשי בתוך המערכת",
      href: "/notes",
      icon: FileText,
    },
  ];

  return (
    <>
      <PageHeader
        title="סקירה"
        description="סביבה אחת לכל הנתונים, השיבוצים, המשימות והמסמכים — במקום Airtable, Notion וגוגל דוקס."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.href} href={stat.href}>
              <Surface className="h-full p-5 transition-transform hover:-translate-y-0.5">
                <div className="flex items-start justify-between">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <span className="rounded-lg bg-accent p-2 text-accent-foreground">
                    <Icon className="size-4" />
                  </span>
                </div>
                <p className="mt-3 text-3xl font-semibold tracking-tight">{stat.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
              </Surface>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Surface className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">אירועים קרובים</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/events">לכל האירועים</Link>
            </Button>
          </div>
          <div className="space-y-3">
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">אין אירועים קרובים.</p>
            ) : (
              upcoming.map((event) => (
                <div key={event.id} className="rounded-xl border bg-background/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{formatHebrewDate(event.date)}</p>
                    <EventStatusBadge status={event.status} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {event.notes || "אין תיעוד"}
                    {event.internal ? " · פנימי" : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {event.evaluators.map((evaluator) => (
                      <EvaluatorChip key={evaluator.id} evaluator={evaluator} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </Surface>

        <Surface className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">משימות פתוחות</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/tasks">לכל המשימות</Link>
            </Button>
          </div>
          <div className="space-y-3">
            {activeTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">אין משימות פתוחות.</p>
            ) : (
              activeTasks.map((task) => (
                <div key={task.id} className="flex items-start justify-between gap-3 rounded-xl border bg-background/70 p-3">
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {task.assignee ? `${task.assignee} · ` : ""}
                      {task.dueDate ? `יעד: ${formatHebrewShortDate(task.dueDate)}` : "ללא תאריך יעד"}
                    </p>
                  </div>
                  <TaskStatusBadge status={task.status} />
                </div>
              ))
            )}
          </div>
        </Surface>
      </div>
    </>
  );
}
