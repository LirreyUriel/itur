export const EVENT_STATUSES = [
  "Approved",
  "In Process",
  "Denied",
  "To be done (TBD)",
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  Approved: "אושר",
  "In Process": "בטיפול",
  Denied: "נדחה",
  "To be done (TBD)": "לביצוע (TBD)",
};

export const TASK_STATUSES = ["לביצוע", "בטיפול", "בוצע"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const EVALUATOR_ROLES = [
  "מראיין",
  "מנהל תרגיל",
  "צופה",
  "רכז",
  "בוחן",
] as const;

export const YEAR_OPTIONS = [
  "א׳",
  "ב׳",
  "ג׳",
  "ד׳",
  "ה׳",
  "ו׳",
  "ז׳",
  "ח׳",
  "ט׳",
  "י׳",
  "י״א",
  "י״ב",
  "י״ג",
  "י״ד",
] as const;

export const HEBREW_MONTHS_SHORT = [
  "ינו׳",
  "פבר׳",
  "מרץ",
  "אפר׳",
  "מאי",
  "יוני",
  "יולי",
  "אוג׳",
  "ספט׳",
  "אוק׳",
  "נוב׳",
  "דצמ׳",
] as const;

export function asStringArray(value: unknown): string[] {
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value;
  }
  return [];
}

export function isEventStatus(value: string): value is EventStatus {
  return (EVENT_STATUSES as readonly string[]).includes(value);
}

export function isTaskStatus(value: string): value is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(value);
}
