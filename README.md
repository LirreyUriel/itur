# איתור

מערכת ניהול פנימית למעריכים, אירועים, סיכום חודשי אוטומטי, משימות ומסמכים.

כל הנתונים נשמרים במסד Postgres קבוע בענן, כך שהאתר ב-Vercel וההרצה המקומית רואים את אותו מידע. גיבוי מקומי נשאר בתיקיית `data/itur.db`.

אין להריץ `prisma db seed`, `db push --force-reset` או כל פקודה שמוחקת את המסד — זה ימחק את המידע שלך.

## הרצה מקומית

```bash
npm install
npx prisma db push
npm run dev
```

האפליקציה תיפתח ב-http://localhost:3000

גיבוי ידני:

```bash
npm run backup
```
