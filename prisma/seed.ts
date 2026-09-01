import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SeedEvaluator = {
  sortOrder: number;
  name: string;
  roles: string[];
  year: string;
  tz: string;
  ma: string;
  email: string;
  relevantTo2026: boolean;
};

type SeedEvent = {
  date: string;
  notes: string;
  status: string;
  evaluatorNames: string[];
};

type SeedData = {
  evaluators: SeedEvaluator[];
  events: SeedEvent[];
};

async function main() {
  const existing =
    (await prisma.evaluator.count()) +
    (await prisma.event.count()) +
    (await prisma.task.count()) +
    (await prisma.document.count());

  if (existing > 0) {
    throw new Error(
      "המסד כבר מכיל נתונים. הסיד מבוטל כדי לא למחוק מידע קיים. אם באמת צריך להתחיל מחדש — עשי זאת ידנית.",
    );
  }

  const data = JSON.parse(
    readFileSync(join(process.cwd(), "prisma/seed-data.json"), "utf8"),
  ) as SeedData;

  const evaluators = [];
  for (const evaluator of data.evaluators) {
    evaluators.push(
      await prisma.evaluator.create({
        data: {
          name: evaluator.name,
          roles: evaluator.roles,
          year: evaluator.year,
          tz: evaluator.tz,
          ma: evaluator.ma,
          email: evaluator.email,
          relevantTo2026: evaluator.relevantTo2026,
          sortOrder: evaluator.sortOrder,
        },
      }),
    );
  }

  const byName = new Map(evaluators.map((evaluator) => [evaluator.name, evaluator.id]));

  for (const event of data.events) {
    const evaluatorIds = event.evaluatorNames
      .map((name) => byName.get(name))
      .filter((id): id is string => Boolean(id));

    await prisma.event.create({
      data: {
        date: new Date(`${event.date}T12:00:00.000Z`),
        notes: event.notes,
        status: event.status,
        evaluators: {
          connect: evaluatorIds.map((id) => ({ id })),
        },
      },
    });
  }

  await prisma.document.create({
    data: {
      title: "נוהל יום ראיונות",
      sortOrder: 0,
      content: `<h1>נוהל יום ראיונות</h1>
<h2>לפני היום</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>לוודא שכל המעריכים משויכים לאירוע במערכת</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>להדפיס רשימות עם ת.ז ומ.א</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>לתאם חדרים ושילוט</p></div></li></ul>
<h2>במהלך היום</h2>
<ol><li><p>תדריך קצר ב-08:00</p></li><li><p>הפסקות כל 90 דקות</p></li><li><p>תיעוד חריגות בעמודת Notes של האירוע</p></li></ol>
<h2>אחרי היום</h2>
<p>עדכון סטטוס ל-<strong>Approved</strong> או <strong>In Process</strong>, וסיכום במסמך זה או באירוע עצמו.</p>`,
    },
  });

  await prisma.document.create({
    data: {
      title: "רעיונות לשיפור תהליך האיתור",
      sortOrder: 1,
      content: `<h1>רעיונות</h1>
<ul><li><p>לאחד את כל התיעוד כאן במקום גוגל דוקס</p></li><li><p>הסיכום החודשי מחליף נוסחאות ידניות</p></li><li><p>לבדוק מעריכים שאינם מסומנים כרלוונטיים ל-2026 לפני שיבוץ</p></li></ul>`,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
