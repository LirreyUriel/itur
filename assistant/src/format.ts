const TIME_ZONE = "Asia/Jerusalem";

export function formatDateHe(date: Date) {
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(date);
}

export function todayIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function startOfIsoDay(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function endOfIsoDay(isoDate: string) {
  return new Date(`${isoDate}T23:59:59.999Z`);
}

export function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function htmlToText(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(text: string, max = 3500) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
