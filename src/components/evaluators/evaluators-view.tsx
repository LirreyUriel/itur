"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createEvaluator,
  deleteEvaluator,
  toggleEvaluatorRelevant,
  updateEvaluator,
} from "@/actions/evaluators";
import { EVALUATOR_ROLES, YEAR_OPTIONS } from "@/lib/constants";
import type { EvaluatorRecord } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MultiSelect } from "@/components/multi-select";
import { PageHeader, Surface } from "@/components/page-header";

const emptyForm = {
  name: "",
  roles: [] as string[],
  year: "",
  tz: "",
  ma: "",
  email: "",
  relevantTo2026: true,
};

export function EvaluatorsView({ evaluators }: { evaluators: EvaluatorRecord[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EvaluatorRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return evaluators;
    return evaluators.filter((evaluator) =>
      [evaluator.name, evaluator.email, evaluator.tz, evaluator.ma, evaluator.year, ...evaluator.roles]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [evaluators, query]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(evaluator: EvaluatorRecord) {
    setEditing(evaluator);
    setForm({
      name: evaluator.name,
      roles: evaluator.roles,
      year: evaluator.year,
      tz: evaluator.tz,
      ma: evaluator.ma,
      email: evaluator.email,
      relevantTo2026: evaluator.relevantTo2026,
    });
    setOpen(true);
  }

  function submit() {
    startTransition(async () => {
      const result = editing
        ? await updateEvaluator({ id: editing.id, ...form })
        : await createEvaluator(form);

      if (!result.ok) {
        toast.error(result.error ?? "שמירה נכשלה");
        return;
      }
      toast.success(editing ? "המעריך עודכן" : "מעריך חדש נוסף");
      setOpen(false);
    });
  }

  function remove(evaluator: EvaluatorRecord) {
    if (!window.confirm(`למחוק את ${evaluator.name}? המחיקה סופית ולא ניתן לבטל מהמסך.`)) return;
    startTransition(async () => {
      const result = await deleteEvaluator(evaluator.id);
      if (!result.ok) {
        toast.error(result.error ?? "מחיקה נכשלה");
        return;
      }
      toast.success("המעריך נמחק");
      setOpen(false);
    });
  }

  return (
    <>
      <PageHeader
        title="מעריכים"
        description="בנק המעריכים הקבוע. מכאן נמשכים השמות לכל האירועים, המשימות והסיכום החודשי — בלי הקלדה חופשית."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            מעריך חדש
          </Button>
        }
      />

      <Surface>
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="חיפוש לפי שם, ת.ז, מ.א או אימייל"
              className="ps-9"
            />
          </div>
          <p className="text-xs text-muted-foreground">{filtered.length} מעריכים</p>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4">שם</TableHead>
              <TableHead>תפקיד</TableHead>
              <TableHead>שנה</TableHead>
              <TableHead>ת.ז</TableHead>
              <TableHead>מ.א</TableHead>
              <TableHead>אימייל</TableHead>
              <TableHead className="text-center">רלוונטי ל-2026</TableHead>
              <TableHead className="px-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  אין מעריכים להצגה.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((evaluator) => (
                <TableRow key={evaluator.id}>
                  <TableCell className="px-4 font-medium">{evaluator.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {evaluator.roles.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        evaluator.roles.map((role) => (
                          <Badge key={role} variant="secondary">
                            {role}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{evaluator.year || "—"}</TableCell>
                  <TableCell className="font-mono text-xs" dir="ltr">
                    {evaluator.tz || "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs" dir="ltr">
                    {evaluator.ma || "—"}
                  </TableCell>
                  <TableCell dir="ltr" className="text-start">
                    {evaluator.email || "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={evaluator.relevantTo2026}
                      onCheckedChange={(checked) => {
                        startTransition(async () => {
                          await toggleEvaluatorRelevant(evaluator.id, checked === true);
                        });
                      }}
                      aria-label="רלוונטי ל-2026"
                    />
                  </TableCell>
                  <TableCell className="px-4">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(evaluator)}>
                      <Pencil className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Surface>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "עריכת מעריך" : "מעריך חדש"}</DialogTitle>
            <DialogDescription>
              כל השדות זמינים לעריכה. תפקיד תומך בבחירה מרובה.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">שם</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>תפקיד</Label>
              <MultiSelect
                options={EVALUATOR_ROLES.map((role) => ({ value: role, label: role }))}
                selected={form.roles}
                onChange={(roles) => setForm((current) => ({ ...current, roles }))}
                placeholder="בחירת תפקיד אחד או יותר"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>שנה</Label>
                <Select
                  value={form.year || "__none__"}
                  onValueChange={(year) =>
                    setForm((current) => ({ ...current, year: year === "__none__" ? "" : year }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="שנה" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">ללא</SelectItem>
                    {YEAR_OPTIONS.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                    {form.year && !(YEAR_OPTIONS as readonly string[]).includes(form.year) ? (
                      <SelectItem value={form.year}>{form.year}</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Checkbox
                  checked={form.relevantTo2026}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({ ...current, relevantTo2026: checked === true }))
                  }
                  id="relevant"
                />
                <Label htmlFor="relevant">רלוונטי ל-2026</Label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="tz">ת.ז</Label>
                <Input
                  id="tz"
                  dir="ltr"
                  value={form.tz}
                  onChange={(event) => setForm((current) => ({ ...current, tz: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ma">מ.א</Label>
                <Input
                  id="ma"
                  dir="ltr"
                  value={form.ma}
                  onChange={(event) => setForm((current) => ({ ...current, ma: event.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                dir="ltr"
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              />
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
