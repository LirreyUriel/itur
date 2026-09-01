import { addDays, format, parseISO } from "date-fns";
import { he } from "date-fns/locale";
import { HEBREW_MONTHS_SHORT } from "@/lib/constants";

export function toDateInputValue(date: Date | string) {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "yyyy-MM-dd");
}

export function formatHebrewDate(date: Date | string) {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "d בMMMM yyyy", { locale: he });
}

export function formatHebrewShortDate(date: Date | string) {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "d.M.yyyy");
}

export function monthYearKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthYearLabel(year: number, monthIndex: number) {
  const shortYear = String(year).slice(-2);
  return `${HEBREW_MONTHS_SHORT[monthIndex]} ${shortYear}`;
}

export function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

export function todayKey() {
  return format(new Date(), "yyyy-MM-dd");
}

export function isPastEvent(date: Date | string) {
  return toDateInputValue(date) < todayKey();
}

export function isUpcomingEvent(date: Date | string) {
  return toDateInputValue(date) >= todayKey();
}

export function isWithinNextDays(date: Date | string, days: number) {
  const key = toDateInputValue(date);
  const start = todayKey();
  const end = format(addDays(parseISO(start), days), "yyyy-MM-dd");
  return key >= start && key <= end;
}

export function utcDateKey(date: Date | string) {
  const d = typeof date === "string" ? parseISO(date) : date;
  return d.toISOString().slice(0, 10);
}
