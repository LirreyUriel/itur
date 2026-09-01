# איתור

מערכת ניהול פנימית למעריכים, אירועים, סיכום חודשי אוטומטי, משימות ומסמכים.

כל הנתונים נשמרים מקומית בתיקיית `data/` (קובץ `itur.db` ותמונות ב-`uploads/`). הקבצים האלה לא עולים ל-GitHub. גיבויים אוטומטיים נוצרים ב-`data/backups` וגם ב-`Documents\Itur-backups`.

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
