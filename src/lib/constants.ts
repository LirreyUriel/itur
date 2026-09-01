export const EVENT_STATUSES = ["אושר", "בתהליך", "נדחה", "לא ביקשתי"] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

const EVENT_STATUS_ALIASES: Record<string, EventStatus> = {
  Approved: "אושר",
  "In Process": "בתהליך",
  Denied: "נדחה",
  "To be done (TBD)": "לא ביקשתי",
  "בטיפול": "בתהליך",
  "לביצוע (TBD)": "לא ביקשתי",
  אושר: "אושר",
  בתהליך: "בתהליך",
  נדחה: "נדחה",
  "לא ביקשתי": "לא ביקשתי",
};

export const EVENT_STATUS_MIGRATIONS: { from: string; to: EventStatus }[] = [
  { from: "Approved", to: "אושר" },
  { from: "In Process", to: "בתהליך" },
  { from: "Denied", to: "נדחה" },
  { from: "To be done (TBD)", to: "לא ביקשתי" },
  { from: "בטיפול", to: "בתהליך" },
  { from: "לביצוע (TBD)", to: "לא ביקשתי" },
];

export const EVENT_NAME_PRESETS = ["ריאיון", "כנס חבצלות", "מבחני מצב"] as const;
export type EventNamePreset = (typeof EVENT_NAME_PRESETS)[number];
export const EVENT_NAME_OTHER = "אחר";

export const INTERVIEW_EVENT_NAME = "ריאיון";
export const INTERVIEW_ASSIGNMENT_TASK_PREFIX = "שיבוץ מעריכים לריאיון";
export const INTERVIEW_ASSIGNMENT_ASSIGNEE = "לירי";

export const TASK_STATUSES = ["לביצוע", "בטיפול", "בוצע"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const EVALUATOR_ROLES = ["מראיין", "מנהל תרגיל"] as const;

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

export function normalizeEventStatus(value: string): EventStatus | null {
  return EVENT_STATUS_ALIASES[value] ?? null;
}

export function isTaskStatus(value: string): value is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(value);
}

export function isEvaluatorRole(value: string): boolean {
  return (EVALUATOR_ROLES as readonly string[]).includes(value);
}

export function allowedEvaluatorRoles(roles: unknown): string[] {
  return asStringArray(roles).filter(isEvaluatorRole);
}

export function isEventNamePreset(value: string): value is EventNamePreset {
  return (EVENT_NAME_PRESETS as readonly string[]).includes(value);
}

export function parseEventName(notes: string): { kind: EventNamePreset | typeof EVENT_NAME_OTHER; custom: string } {
  if (isEventNamePreset(notes)) {
    return { kind: notes, custom: "" };
  }
  return { kind: EVENT_NAME_OTHER, custom: notes };
}

export function composeEventName(kind: string, custom: string) {
  if (kind === EVENT_NAME_OTHER) return custom.trim();
  return kind;
}

export function isInterviewEvent(notes: string) {
  return notes === INTERVIEW_EVENT_NAME;
}
