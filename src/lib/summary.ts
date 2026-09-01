import { prisma } from "@/lib/prisma";
import { HEBREW_MONTHS_SHORT, normalizeEventStatus } from "@/lib/constants";
import { utcDateKey } from "@/lib/dates";

export type MonthColumn = {
  key: string;
  year: number;
  month: number;
  label: string;
};

export type AttendanceLabel = {
  name: string;
  approved: boolean;
};

export type AttendanceDate = {
  date: string;
  labels: AttendanceLabel[];
};

export type SummaryRow = {
  evaluatorId: string;
  name: string;
  relevantTo2026: boolean;
  counts: Record<string, number>;
  dates: Record<string, AttendanceDate[]>;
  total: number;
};

export type MonthlySummary = {
  months: MonthColumn[];
  rows: SummaryRow[];
  totals: Record<string, number>;
  grandTotal: number;
};

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthLabel(year: number, month: number) {
  return `${HEBREW_MONTHS_SHORT[month - 1]} ${String(year).slice(-2)}`;
}

function buildMonthRange(dates: Date[]) {
  let startYear = 2026;
  let startMonth = 7;
  let endYear = 2027;
  let endMonth = 6;

  if (dates.length > 0) {
    const times = dates.map((item) => item.getTime());
    const min = new Date(Math.min(...times));
    const max = new Date(Math.max(...times));
    startYear = min.getUTCFullYear();
    startMonth = min.getUTCMonth() + 1;
    endYear = max.getUTCFullYear();
    endMonth = max.getUTCMonth() + 1;

    let count =
      (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
    while (count < 12) {
      endMonth += 1;
      if (endMonth > 12) {
        endMonth = 1;
        endYear += 1;
      }
      count += 1;
    }
  }

  const months: MonthColumn[] = [];
  let year = startYear;
  let month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push({
      key: monthKey(year, month),
      year,
      month,
      label: monthLabel(year, month),
    });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return months;
}

export async function getMonthlySummary(): Promise<MonthlySummary> {
  const [evaluators, events] = await Promise.all([
    prisma.evaluator.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, relevantTo2026: true },
    }),
    prisma.event.findMany({
      select: {
        date: true,
        notes: true,
        status: true,
        evaluators: { select: { id: true } },
      },
    }),
  ]);

  const months = buildMonthRange(events.map((event) => event.date));
  const totals: Record<string, number> = Object.fromEntries(
    months.map((month) => [month.key, 0]),
  );

  const countsByEvaluator = new Map<string, Record<string, number>>();
  const datesByEvaluator = new Map<string, Record<string, AttendanceDate[]>>();

  for (const evaluator of evaluators) {
    countsByEvaluator.set(
      evaluator.id,
      Object.fromEntries(months.map((month) => [month.key, 0])),
    );
    datesByEvaluator.set(
      evaluator.id,
      Object.fromEntries(months.map((month) => [month.key, [] as AttendanceDate[]])),
    );
  }

  for (const event of events) {
    const key = monthKey(event.date.getUTCFullYear(), event.date.getUTCMonth() + 1);
    if (!(key in totals)) continue;
    const dateKey = utcDateKey(event.date);
    const name = event.notes.trim() || "ללא שם";
    const approved = (normalizeEventStatus(event.status) ?? event.status) === "אושר";

    for (const evaluator of event.evaluators) {
      const counts = countsByEvaluator.get(evaluator.id);
      const dates = datesByEvaluator.get(evaluator.id);
      if (!counts || !dates) continue;
      counts[key] += 1;
      totals[key] += 1;
      const existing = dates[key].find((item) => item.date === dateKey);
      if (!existing) {
        dates[key].push({ date: dateKey, labels: [{ name, approved }] });
        continue;
      }
      const label = existing.labels.find((item) => item.name === name);
      if (!label) existing.labels.push({ name, approved });
      else if (approved) label.approved = true;
    }
  }

  const rows: SummaryRow[] = evaluators.map((evaluator) => {
    const counts = countsByEvaluator.get(evaluator.id) ?? {};
    const dates = datesByEvaluator.get(evaluator.id) ?? {};
    for (const key of Object.keys(dates)) {
      dates[key] = [...dates[key]].sort((a, b) => a.date.localeCompare(b.date));
    }
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    return {
      evaluatorId: evaluator.id,
      name: evaluator.name,
      relevantTo2026: evaluator.relevantTo2026,
      counts,
      dates,
      total,
    };
  });

  const grandTotal = Object.values(totals).reduce((sum, value) => sum + value, 0);

  return { months, rows, totals, grandTotal };
}
