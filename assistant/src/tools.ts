import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";
import { prisma } from "./db";
import {
  asStringArray,
  endOfIsoDay,
  formatDateHe,
  htmlToText,
  startOfIsoDay,
  todayIso,
} from "./format";

type JsonRecord = Record<string, unknown>;

function takeLimit(value: unknown, fallback = 12, max = 25) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(1, Math.trunc(n)));
}

function textFilter(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function boolFilter(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: "search_events",
    description:
      "Search events (אירועים). Event name is stored in notes. Includes assigned evaluators (attendees). Use for questions like who is coming, upcoming interviews, status of an event.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: {
          type: SchemaType.STRING,
          description: "Event name or notes fragment, e.g. ריאיון, מבחני מצב, כנס חבצלות",
        },
        dateFrom: { type: SchemaType.STRING, description: "Inclusive start date YYYY-MM-DD" },
        dateTo: { type: SchemaType.STRING, description: "Inclusive end date YYYY-MM-DD" },
        status: {
          type: SchemaType.STRING,
          description: "אושר | בתהליך | נדחה | לא ביקשתי",
        },
        upcomingOnly: { type: SchemaType.BOOLEAN, description: "Only today and future events" },
        includeInternal: { type: SchemaType.BOOLEAN, description: "Include internal events. Default false." },
        take: { type: SchemaType.NUMBER, description: "Max rows, default 12" },
      },
    },
  },
  {
    name: "get_event_attendees",
    description:
      "List people (evaluators / מעריכים) assigned to one event. Prefer eventId from search_events. Otherwise match by name and/or date.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        eventId: { type: SchemaType.STRING, description: "Event id from search_events" },
        eventName: { type: SchemaType.STRING, description: "Event name in notes" },
        date: { type: SchemaType.STRING, description: "Event date YYYY-MM-DD" },
      },
    },
  },
  {
    name: "search_evaluators",
    description: "Search people in the evaluator roster (מעריכים), including roles, year, tz, ma, email.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING, description: "Person name fragment" },
        role: { type: SchemaType.STRING, description: "מראיין or מנהל תרגיל" },
        year: { type: SchemaType.STRING, description: "Year label such as י״ב" },
        relevantTo2026: { type: SchemaType.BOOLEAN },
        take: { type: SchemaType.NUMBER },
      },
    },
  },
  {
    name: "get_evaluator_schedule",
    description: "List events a named evaluator is assigned to.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING, description: "Evaluator name" },
        upcomingOnly: { type: SchemaType.BOOLEAN },
        take: { type: SchemaType.NUMBER },
      },
      required: ["name"],
    },
  },
  {
    name: "search_tasks",
    description: "Search tasks (משימות) by title, status, or assignee.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: "Title or notes fragment" },
        status: { type: SchemaType.STRING, description: "לביצוע | בטיפול | בוצע" },
        assignee: { type: SchemaType.STRING },
        openOnly: { type: SchemaType.BOOLEAN, description: "Exclude tasks marked בוצע" },
        take: { type: SchemaType.NUMBER },
      },
    },
  },
  {
    name: "search_documents",
    description: "Search saved documents (מסמכים) by title, folder, or body text. Returns a short preview only.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: "Search text" },
        take: { type: SchemaType.NUMBER },
      },
      required: ["query"],
    },
  },
];

function serializeEvent(
  event: {
    id: string;
    date: Date;
    notes: string;
    status: string;
    internal: boolean;
    evaluators: { name: string; roles: unknown; year: string }[];
  },
) {
  return {
    id: event.id,
    date: formatDateHe(event.date),
    isoDate: event.date.toISOString().slice(0, 10),
    name: event.notes || "(בלי שם)",
    status: event.status,
    internal: event.internal,
    attendees: event.evaluators.map((person) => ({
      name: person.name,
      roles: asStringArray(person.roles),
      year: person.year,
    })),
    attendeeCount: event.evaluators.length,
  };
}

async function searchEvents(args: JsonRecord) {
  const query = textFilter(args.query);
  const dateFrom = textFilter(args.dateFrom);
  const dateTo = textFilter(args.dateTo);
  const status = textFilter(args.status);
  const upcomingOnly = boolFilter(args.upcomingOnly);
  const includeInternal = boolFilter(args.includeInternal) ?? false;
  const take = takeLimit(args.take);

  const events = await prisma.event.findMany({
    where: {
      ...(query ? { notes: { contains: query, mode: "insensitive" } } : {}),
      ...(status ? { status: { contains: status, mode: "insensitive" } } : {}),
      ...(includeInternal ? {} : { internal: false }),
      ...((dateFrom || dateTo || upcomingOnly) && {
        date: {
          ...(dateFrom || upcomingOnly
            ? { gte: startOfIsoDay(dateFrom || todayIso()) }
            : {}),
          ...(dateTo ? { lte: endOfIsoDay(dateTo) } : {}),
        },
      }),
    },
    include: {
      evaluators: {
        orderBy: { name: "asc" },
        select: { name: true, roles: true, year: true },
      },
    },
    orderBy: { date: "asc" },
    take,
  });

  return { count: events.length, events: events.map(serializeEvent) };
}

async function getEventAttendees(args: JsonRecord) {
  const eventId = textFilter(args.eventId);
  const eventName = textFilter(args.eventName);
  const date = textFilter(args.date);

  const events = await prisma.event.findMany({
    where: eventId
      ? { id: eventId }
      : {
          ...(eventName ? { notes: { contains: eventName, mode: "insensitive" } } : {}),
          ...(date
            ? { date: { gte: startOfIsoDay(date), lte: endOfIsoDay(date) } }
            : {}),
        },
    include: {
      evaluators: {
        orderBy: { name: "asc" },
        select: { name: true, roles: true, year: true, tz: true, ma: true, email: true },
      },
    },
    orderBy: { date: "asc" },
    take: eventId ? 1 : 8,
  });

  if (events.length === 0) {
    return { count: 0, message: "לא נמצא אירוע תואם." };
  }

  return {
    count: events.length,
    events: events.map((event) => ({
      ...serializeEvent(event),
      attendees: event.evaluators.map((person) => ({
        name: person.name,
        roles: asStringArray(person.roles),
        year: person.year,
        tz: person.tz,
        ma: person.ma,
        email: person.email,
      })),
    })),
  };
}

async function searchEvaluators(args: JsonRecord) {
  const name = textFilter(args.name);
  const role = textFilter(args.role);
  const year = textFilter(args.year);
  const relevantTo2026 = boolFilter(args.relevantTo2026);
  const take = takeLimit(args.take, 15);

  const people = await prisma.evaluator.findMany({
    where: {
      ...(name ? { name: { contains: name, mode: "insensitive" } } : {}),
      ...(year ? { year: { contains: year } } : {}),
      ...(relevantTo2026 === undefined ? {} : { relevantTo2026 }),
    },
    include: {
      events: {
        where: { date: { gte: startOfIsoDay(todayIso()) } },
        orderBy: { date: "asc" },
        take: 5,
        select: { id: true, date: true, notes: true, status: true },
      },
    },
    orderBy: [{ name: "asc" }],
    take: take * 3,
  });

  const filtered = people.filter((person) => {
    if (!role) return true;
    return asStringArray(person.roles).some((item) => item.includes(role));
  });

  return {
    count: Math.min(filtered.length, take),
    evaluators: filtered.slice(0, take).map((person) => ({
      id: person.id,
      name: person.name,
      roles: asStringArray(person.roles),
      year: person.year,
      tz: person.tz,
      ma: person.ma,
      email: person.email,
      relevantTo2026: person.relevantTo2026,
      upcomingEvents: person.events.map((event) => ({
        id: event.id,
        date: formatDateHe(event.date),
        name: event.notes,
        status: event.status,
      })),
    })),
  };
}

async function getEvaluatorSchedule(args: JsonRecord) {
  const name = textFilter(args.name);
  if (!name) return { error: "חסר שם מעריך." };
  const upcomingOnly = boolFilter(args.upcomingOnly) ?? true;
  const take = takeLimit(args.take, 20);

  const person = await prisma.evaluator.findFirst({
    where: { name: { contains: name, mode: "insensitive" } },
    include: {
      events: {
        where: upcomingOnly ? { date: { gte: startOfIsoDay(todayIso()) } } : {},
        orderBy: { date: "asc" },
        take,
        include: {
          evaluators: { select: { name: true, roles: true, year: true } },
        },
      },
    },
  });

  if (!person) return { count: 0, message: `לא נמצא מעריך בשם ${name}.` };

  return {
    evaluator: {
      name: person.name,
      roles: asStringArray(person.roles),
      year: person.year,
    },
    count: person.events.length,
    events: person.events.map((event) => serializeEvent(event)),
  };
}

async function searchTasks(args: JsonRecord) {
  const query = textFilter(args.query);
  const status = textFilter(args.status);
  const assignee = textFilter(args.assignee);
  const openOnly = boolFilter(args.openOnly);
  const take = takeLimit(args.take, 15);

  const tasks = await prisma.task.findMany({
    where: {
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { notes: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(status ? { status: { contains: status, mode: "insensitive" } } : {}),
      ...(assignee ? { assignee: { contains: assignee, mode: "insensitive" } } : {}),
      ...(openOnly ? { NOT: { status: "בוצע" } } : {}),
    },
    include: {
      event: { select: { id: true, date: true, notes: true } },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take,
  });

  return {
    count: tasks.length,
    tasks: tasks.map((task) => ({
      title: task.title,
      status: task.status,
      assignee: task.assignee || null,
      notes: task.notes || null,
      dueDate: task.dueDate ? formatDateHe(task.dueDate) : null,
      event: task.event
        ? {
            id: task.event.id,
            date: formatDateHe(task.event.date),
            name: task.event.notes,
          }
        : null,
    })),
  };
}

async function searchDocuments(args: JsonRecord) {
  const query = textFilter(args.query);
  if (!query) return { error: "חסר טקסט לחיפוש." };
  const take = takeLimit(args.take, 8, 12);

  const documents = await prisma.document.findMany({
    where: {
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
        { folder: { name: { contains: query, mode: "insensitive" } } },
      ],
    },
    include: { folder: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take,
  });

  return {
    count: documents.length,
    documents: documents.map((document) => ({
      title: document.title,
      folder: document.folder?.name ?? "ללא תיקייה",
      preview: htmlToText(document.content).slice(0, 280) || "מסמך ריק",
      updatedAt: formatDateHe(document.updatedAt),
    })),
  };
}

const handlers: Record<string, (args: JsonRecord) => Promise<unknown>> = {
  search_events: searchEvents,
  get_event_attendees: getEventAttendees,
  search_evaluators: searchEvaluators,
  get_evaluator_schedule: getEvaluatorSchedule,
  search_tasks: searchTasks,
  search_documents: searchDocuments,
};

export async function executeTool(name: string, args: unknown) {
  const handler = handlers[name];
  if (!handler) {
    return { error: `Unknown tool: ${name}` };
  }
  const record = args && typeof args === "object" ? (args as JsonRecord) : {};
  try {
    return await handler(record);
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאת מסד נתונים";
    return { error: message };
  }
}
