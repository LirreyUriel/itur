"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createEvent,
  deleteEvent,
  updateEvent,
  updateEventInternal,
  updateEventStatus,
} from "@/actions/events";
import {
  composeEventName,
  EVENT_NAME_OTHER,
  EVENT_NAME_PRESETS,
  EVENT_STATUSES,
  parseEventName,
  type EventStatus,
} from "@/lib/constants";
import { formatHebrewDate, isPastEvent, isUpcomingEvent, toDateInputValue } from "@/lib/dates";
import { needsInterviewAssignment } from "@/lib/event-rules";
import type { EvaluatorRecord, EventRecord } from "@/lib/types";
import { EvaluatorChip } from "@/components/evaluator-chip";
import { MultiSelect } from "@/components/multi-select";
import { PageHeader, Surface } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const emptyForm = {
  date: "",
  nameKind: EVENT_NAME_PRESETS[0] as string,
  nameCustom: "",
  status: "לא ביקשתי" as EventStatus,
  evaluatorIds: [] as string[],
  internal: false,
};

export function EventsView({
  events,
  evaluators,
}: {
  events: EventRecord[];
  evaluators: EvaluatorRecord[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EventRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState("");
  const [upcomingOnly, setUpcomingOnly] = useState(true);
  const [internalById, setInternalById] = useState<Record<string, boolean>>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setInternalById((current) => {
      let changed = false;
      const next = { ...current };
      for (const event of events) {
        if (event.id in next && next[event.id] === event.internal) {
          delete next[event.id];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [events]);

  const evaluatorOptions = useMemo(
    () => evaluators.map((evaluator) => ({ value: evaluator.id, label: evaluator.name })),
    [evaluators],
  );

  const filteredEvents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return events.filter((event) => {
      if (upcomingOnly && !isUpcomingEvent(event.date)) return false;
      if (!needle) return true;
      return [
        event.notes,
        event.status,
        event.internal ? "פנימי" : "",
        ...event.evaluators.map((evaluator) => evaluator.name),
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [events, query, upcomingOnly]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(event: EventRecord) {
    const parsed = parseEventName(event.notes);
    setEditing(event);
    setForm({
      date: toDateInputValue(event.date),
      nameKind: parsed.kind,
      nameCustom: parsed.custom,
      status: event.status as EventStatus,
      evaluatorIds: event.evaluators.map((evaluator) => evaluator.id),
      internal: event.internal,
    });
    setOpen(true);
  }

  function submit() {
    const notes = composeEventName(form.nameKind, form.nameCustom);
    startTransition(async () => {
      const payload = {
        date: form.date,
        notes,
        status: form.status,
        evaluatorIds: form.evaluatorIds,
        internal: form.internal,
      };
      const result = editing
        ? await updateEvent({ id: editing.id, ...payload })
        : await createEvent(payload);

      if (!result.ok) {
        toast.error(result.error ?? "שמירה נכשלה");
        return;
      }
      toast.success(editing ? "האירוע עודכן" : "תאריך חדש נוסף");
      setOpen(false);
    });
  }

  function remove(event: EventRecord) {
    if (!window.confirm("למחוק את האירוע? המחיקה סופית ולא ניתן לבטל מהמסך.")) return;
    startTransition(async () => {
      const result = await deleteEvent(event.id);
      if (!result.ok) {
        toast.error(result.error ?? "מחיקה נכשלה");
        return;
      }
      toast.success("האירוע נמחק");
      setOpen(false);
    });
  }

  function isInternal(event: EventRecord) {
    return event.id in internalById ? internalById[event.id] : event.internal;
  }

  return (
    <>
      <PageHeader
        title="אירועים"
        description="רשימת תאריכים דינמית עם שם אירוע, שיבוץ מעריכים מתוך הבנק, וסטטוס ידני."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            תאריך חדש
          </Button>
        }
      />

      <Surface>
        <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="חיפוש לפי שם, מעריך או סטטוס"
              className="ps-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="upcoming-only" checked={upcomingOnly} onCheckedChange={setUpcomingOnly} />
            <Label htmlFor="upcoming-only" className="cursor-pointer text-sm">
              רק אירועים שעוד לא קרו
            </Label>
          </div>
          <p className="text-xs text-muted-foreground sm:ms-auto">{filteredEvents.length} אירועים</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4">תאריך</TableHead>
              <TableHead className="min-w-[240px]">שם</TableHead>
              <TableHead className="min-w-[200px]">מעריך</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead className="text-center">פנימי</TableHead>
              <TableHead className="px-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEvents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {events.length === 0
                    ? "עדיין אין אירועים. הוסיפו תאריך ראשון."
                    : "אין אירועים שתואמים לסינון."}
                </TableCell>
              </TableRow>
            ) : (
              filteredEvents.map((event) => {
                const past = isPastEvent(event.date);
                const warn = needsInterviewAssignment({
                  notes: event.notes,
                  date: event.date,
                  evaluatorCount: event.evaluators.length,
                });
                return (
                  <TableRow
                    key={event.id}
                    className={cn(
                      past && !warn && "bg-[#E8F5E9] hover:bg-[#dcedd4]",
                      warn && "bg-[#FFF59D] hover:bg-[#FDD835]",
                    )}
                  >
                    <TableCell className="px-4 whitespace-nowrap font-medium">
                      {formatHebrewDate(event.date)}
                    </TableCell>
                    <TableCell className="max-w-md whitespace-normal text-muted-foreground">
                      {event.notes || <span className="italic">אין שם עדיין</span>}
                    </TableCell>
                    <TableCell>
                      {event.evaluators.length === 0 ? (
                        <span className="text-muted-foreground">לא שובץ</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {event.evaluators.map((evaluator) => (
                            <EvaluatorChip key={evaluator.id} evaluator={evaluator} />
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={event.status}
                        onValueChange={(status) => {
                          startTransition(async () => {
                            const result = await updateEventStatus(event.id, status);
                            if (!result.ok) toast.error(result.error);
                          });
                        }}
                      >
                        <SelectTrigger className="h-8 w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EVENT_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        id={`event-internal-${event.id}`}
                        checked={isInternal(event)}
                        onClick={(clickEvent) => clickEvent.stopPropagation()}
                        onCheckedChange={(checked) => {
                          const next = checked === true;
                          setInternalById((current) => ({ ...current, [event.id]: next }));
                          startTransition(async () => {
                            const result = await updateEventInternal(event.id, next);
                            if (!result.ok) {
                              setInternalById((current) => ({
                                ...current,
                                [event.id]: event.internal,
                              }));
                              toast.error(result.error ?? "לא ניתן לעדכן סימון פנימי");
                            }
                          });
                        }}
                        aria-label={`אירוע פנימי ${event.notes || formatHebrewDate(event.date)}`}
                      />
                    </TableCell>
                    <TableCell className="px-4">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(event)}>
                        <Pencil className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Surface>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "עריכת אירוע" : "תאריך חדש"}</DialogTitle>
            <DialogDescription>
              המעריכים נבחרים מתוך בנק המעריכים בלבד. ריחוף על שם מציג ת.ז ומ.א.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="date">תאריך</Label>
              <Input
                id="date"
                type="date"
                value={form.date}
                onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-name-kind">שם</Label>
              <Select
                value={form.nameKind}
                onValueChange={(nameKind) => setForm((current) => ({ ...current, nameKind }))}
              >
                <SelectTrigger id="event-name-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_NAME_PRESETS.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                  <SelectItem value={EVENT_NAME_OTHER}>{EVENT_NAME_OTHER}</SelectItem>
                </SelectContent>
              </Select>
              {form.nameKind === EVENT_NAME_OTHER ? (
                <Input
                  id="event-name-custom"
                  value={form.nameCustom}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, nameCustom: event.target.value }))
                  }
                  placeholder="שם האירוע"
                />
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label>מעריכים משובצים</Label>
              <MultiSelect
                options={evaluatorOptions}
                selected={form.evaluatorIds}
                onChange={(evaluatorIds) => setForm((current) => ({ ...current, evaluatorIds }))}
                placeholder="בחירה מתוך בנק המעריכים"
                searchPlaceholder="חיפוש מעריך..."
                emptyText="אין מעריכים בבנק"
              />
            </div>
            <div className="grid gap-2">
              <Label>סטטוס</Label>
              <Select
                value={form.status}
                onValueChange={(status) =>
                  setForm((current) => ({ ...current, status: status as EventStatus }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="event-form-internal"
                checked={form.internal}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, internal: checked === true }))
                }
              />
              <Label htmlFor="event-form-internal" className="cursor-pointer">
                אירוע פנימי (לא יום מיון רשמי)
              </Label>
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
