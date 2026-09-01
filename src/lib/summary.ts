import { prisma } from "@/lib/prisma";
import { HEBREW_MONTHS_SHORT } from "@/lib/constants";

export type MonthColumn = {
  key: string;
  year: number;
  month: number;
  label: string;
};

export type SummaryRow = {
  evaluatorId: string;
  name: string;
  relevantTo2026: boolean;
  counts: Record<string, number>;
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
        evaluators: { select: { id: true } },
      },
    }),
  ]);

  const months = buildMonthRange(events.map((event) => event.date));
  const totals: Record<string, number> = Object.fromEntries(
    months.map((month) => [month.key, 0]),
  );

  const countsByEvaluator = new Map<string, Record<string, number>>();

  for (const evaluator of evaluators) {
    countsByEvaluator.set(
      evaluator.id,
      Object.fromEntries(months.map((month) => [month.key, 0])),
    );
  }

  for (const event of events) {
    const key = monthKey(event.date.getUTCFullYear(), event.date.getUTCMonth() + 1);
    if (!(key in totals)) continue;

    for (const evaluator of event.evaluators) {
      const counts = countsByEvaluator.get(evaluator.id);
      if (!counts) continue;
      counts[key] += 1;
      totals[key] += 1;
    }
  }

  const rows: SummaryRow[] = evaluators.map((evaluator) => {
    const counts = countsByEvaluator.get(evaluator.id) ?? {};
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    return {
      evaluatorId: evaluator.id,
      name: evaluator.name,
      relevantTo2026: evaluator.relevantTo2026,
      counts,
      total,
    };
  });

  const grandTotal = Object.values(totals).reduce((sum, value) => sum + value, 0);

  return { months, rows, totals, grandTotal };
}
