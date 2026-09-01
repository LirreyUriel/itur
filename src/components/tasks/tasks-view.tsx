"use client";

import { useState, useTransition } from "react";
import { Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createTask, deleteTask, updateTask, updateTaskStatus } from "@/actions/tasks";
import { TASK_STATUSES, type TaskStatus } from "@/lib/constants";
import { formatHebrewShortDate, toDateInputValue } from "@/lib/dates";
import type { EventRecord, TaskLink, TaskRecord } from "@/lib/types";
import { PageHeader, Surface } from "@/components/page-header";
import { TaskStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const emptyForm = {
  title: "",
  status: "לביצוע" as TaskStatus,
  assignee: "",
  notes: "",
  links: [] as TaskLink[],
  dueDate: "",
  eventId: "",
};

export function TasksView({
  tasks,
  events,
}: {
  tasks: TaskRecord[];
  events: EventRecord[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TaskRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [pending, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(task: TaskRecord) {
    setEditing(task);
    setForm({
      title: task.title,
      status: task.status as TaskStatus,
      assignee: task.assignee,
      notes: task.notes,
      links: task.links.length > 0 ? task.links : [],
      dueDate: task.dueDate ? toDateInputValue(task.dueDate) : "",
      eventId: task.eventId ?? "",
    });
    setOpen(true);
  }

  function submit() {
    startTransition(async () => {
      const payload = {
        title: form.title,
        status: form.status,
        assignee: form.assignee,
        notes: form.notes,
        links: form.links,
        dueDate: form.dueDate || null,
        eventId: form.eventId || null,
      };
      const result = editing
        ? await updateTask({ id: editing.id, ...payload })
        : await createTask(payload);

      if (!result.ok) {
        toast.error(result.error ?? "שמירה נכשלה");
        return;
      }
      toast.success(editing ? "המשימה עודכנה" : "משימה חדשה נוספה");
      setOpen(false);
    });
  }

  function remove(task: TaskRecord) {
    if (!window.confirm("למחוק את המשימה? המחיקה סופית ולא ניתן לבטל מהמסך.")) return;
    startTransition(async () => {
      const result = await deleteTask(task.id);
      if (!result.ok) {
        toast.error(result.error ?? "מחיקה נכשלה");
        return;
      }
      toast.success("המשימה נמחקה");
      setOpen(false);
    });
  }

  function updateLink(index: number, patch: Partial<TaskLink>) {
    setForm((current) => ({
      ...current,
      links: current.links.map((link, i) => (i === index ? { ...link, ...patch } : link)),
    }));
  }

  return (
    <>
      <PageHeader
        title="משימות"
        description="לוח משימות שוטף עם אחראי חופשי, קישורים, הערות ותאריך יעד."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            משימה חדשה
          </Button>
        }
      />

      <Surface>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4">כותרת</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead>אחראי</TableHead>
              <TableHead>תאריך יעד</TableHead>
              <TableHead>קישורים</TableHead>
              <TableHead className="px-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  אין משימות עדיין.
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="px-4 font-medium whitespace-normal">
                    <div>{task.title}</div>
                    {task.notes ? (
                      <p className="mt-1 line-clamp-2 text-xs font-normal text-muted-foreground">
                        {task.notes}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={task.status}
                      onValueChange={(status) => {
                        startTransition(async () => {
                          const result = await updateTaskStatus(task.id, status);
                          if (!result.ok) toast.error(result.error);
                        });
                      }}
                    >
                      <SelectTrigger className="h-8 w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{task.assignee || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    {task.dueDate ? formatHebrewShortDate(task.dueDate) : "—"}
                  </TableCell>
                  <TableCell>
                    {task.links.length === 0 ? (
                      "—"
                    ) : (
                      <div className="flex flex-col gap-1">
                        {task.links.map((link) => (
                          <a
                            key={`${link.url}-${link.label}`}
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
                          >
                            <Link2 className="size-3" />
                            {link.label || link.url}
                          </a>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="flex items-center gap-2">
                      <TaskStatusBadge status={task.status} />
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(task)}>
                        <Pencil className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Surface>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "עריכת משימה" : "משימה חדשה"}</DialogTitle>
            <DialogDescription>אחראי בטקסט חופשי, קישורים והערות אישיות בתוך המשימה.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="title">כותרת</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>סטטוס</Label>
                <Select
                  value={form.status}
                  onValueChange={(status) =>
                    setForm((current) => ({ ...current, status: status as TaskStatus }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="due">תאריך יעד</Label>
                <Input
                  id="due"
                  type="date"
                  value={form.dueDate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, dueDate: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="assignee">אחראי</Label>
              <Input
                id="assignee"
                value={form.assignee}
                onChange={(event) =>
                  setForm((current) => ({ ...current, assignee: event.target.value }))
                }
                placeholder="שם חופשי"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-notes">הערות לעצמי</Label>
              <Textarea
                id="task-notes"
                rows={3}
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="תזכורות, הקשר, מה נשאר לבדוק..."
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>קישורים</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      links: [...current.links, { label: "", url: "" }],
                    }))
                  }
                >
                  <Plus className="size-3.5" />
                  קישור
                </Button>
              </div>
              {form.links.length === 0 ? (
                <p className="text-xs text-muted-foreground">אין קישורים עדיין.</p>
              ) : (
                <div className="grid gap-2">
                  {form.links.map((link, index) => (
                    <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                      <Input
                        placeholder="כותרת"
                        value={link.label}
                        onChange={(event) => updateLink(index, { label: event.target.value })}
                      />
                      <Input
                        dir="ltr"
                        placeholder="https://"
                        value={link.url}
                        onChange={(event) => updateLink(index, { url: event.target.value })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            links: current.links.filter((_, i) => i !== index),
                          }))
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="grid gap-2">
              <Label>קישור לאירוע (אופציונלי)</Label>
              <Select
                value={form.eventId || "none"}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, eventId: value === "none" ? "" : value }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="ללא קישור" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא קישור</SelectItem>
                  {events.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {formatHebrewShortDate(event.date)}
                      {event.notes ? ` · ${event.notes.slice(0, 24)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {editing ? (
              <Button variant="destructive" onClick={() => remove(editing)} disabled={pending}>
                <Trash2 className="size-4" />
                מחיקה
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                ביטול
              </Button>
              <Button onClick={submit} disabled={pending}>
                {pending ? "שומר..." : "שמירה"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
