"use client";

import { useMemo, useState } from "react";
import { PageHeader, Surface } from "@/components/page-header";
import { formatHebrewDate } from "@/lib/dates";
import type { AttendanceDate, MonthlySummary } from "@/lib/summary";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type DateDialog = {
  name: string;
  monthLabel: string;
  dates: AttendanceDate[];
};

export function SummaryView({ summary }: { summary: MonthlySummary }) {
  const [relevantOnly, setRelevantOnly] = useState(true);
  const [dateDialog, setDateDialog] = useState<DateDialog | null>(null);
  const months = summary.months;
  const rows = useMemo(
    () =>
      relevantOnly
        ? summary.rows.filter((row) => row.relevantTo2026)
        : summary.rows,
    [relevantOnly, summary.rows],
  );
  const totals = useMemo(() => {
    const next: Record<string, number> = Object.fromEntries(
      months.map((month) => [month.key, 0]),
    );
    for (const row of rows) {
      for (const month of months) {
        next[month.key] += row.counts[month.key] ?? 0;
      }
    }
    return next;
  }, [months, rows]);

  return (
    <>
      <PageHeader
        title="סיכום חודשי"
        description="טבלה אוטומטית לחלוטין: המעריכים מהבנק, וספירת הימים ששובץ אליהם בכל חודש לפי טבלת האירועים. אין נוסחאות ידניות."
        actions={
          <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2">
            <Switch
              id="relevant-only"
              checked={relevantOnly}
              onCheckedChange={setRelevantOnly}
            />
            <Label htmlFor="relevant-only" className="cursor-pointer text-sm">
              רלוונטיים ל-2026 בלבד
            </Label>
          </div>
        }
      />

      <Surface>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max caption-bottom text-sm">
            <thead>
              <tr className="border-b">
                <th className="sticky start-0 z-10 bg-card px-4 py-3 text-start font-medium">
                  מעריך
                </th>
                {months.map((month) => (
                  <th key={month.key} className="px-3 py-3 text-center font-medium whitespace-nowrap">
                    {month.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-center font-medium">סה״כ</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={months.length + 2} className="h-24 text-center text-muted-foreground">
                    אין מעריכים להצגה.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.evaluatorId} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="sticky start-0 z-10 bg-card px-4 py-3 text-start font-medium">
                      <div className="flex items-center gap-2">
                        <span>{row.name}</span>
                        {row.relevantTo2026 ? (
                          <Badge variant="secondary" className="text-[10px]">
                            2026
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    {months.map((month) => {
                      const value = row.counts[month.key] ?? 0;
                      const dates = row.dates[month.key] ?? [];
                      return (
                        <td
                          key={month.key}
                          className={cn(
                            "px-3 py-3 text-center tabular-nums",
                            value > 0
                              ? "font-semibold text-foreground"
                              : "text-muted-foreground/50",
                          )}
                        >
                          {value > 0 ? (
                            <button
                              type="button"
                              className="underline-offset-2 hover:underline"
                              onClick={() =>
                                setDateDialog({
                                  name: row.name,
                                  monthLabel: month.label,
                                  dates,
                                })
                              }
                            >
                              {value}
                            </button>
                          ) : (
                            "—"
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center font-semibold tabular-nums">
                      {months.reduce((sum, month) => sum + (row.counts[month.key] ?? 0), 0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/60 font-semibold">
                <td className="sticky start-0 z-10 bg-muted/60 px-4 py-3 text-start">סך הכל</td>
                {months.map((month) => (
                  <td key={month.key} className="px-3 py-3 text-center tabular-nums">
                    {totals[month.key] ?? 0}
                  </td>
                ))}
                <td className="px-4 py-3 text-center tabular-nums">
                  {months.reduce((sum, month) => sum + (totals[month.key] ?? 0), 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Surface>

      <Dialog open={dateDialog !== null} onOpenChange={(open) => !open && setDateDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{dateDialog?.name}</DialogTitle>
            <DialogDescription>
              תאריכי הגעה בחודש {dateDialog?.monthLabel}
            </DialogDescription>
          </DialogHeader>
          {dateDialog && dateDialog.dates.length > 0 ? (
            <ul className="grid gap-2 text-sm">
              {dateDialog.dates.map((item) => (
                <li key={item.date} className="rounded-lg border bg-muted/40 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{formatHebrewDate(item.date)}</p>
                    {item.labels.some((label) => label.approved) ? (
                      <Badge className="text-[10px]">אושר</Badge>
                    ) : null}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {item.labels.map((label) => (
                      <Badge
                        key={`${item.date}-${label.name}`}
                        variant={label.approved ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {label.name}
                      </Badge>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">אין תאריכים בחודש זה.</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
