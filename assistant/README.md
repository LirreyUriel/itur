# LIRITUR WhatsApp assistant

Private personal assistant: it connects to WhatsApp via QR, answers **only** messages from `MY_PHONE_NUMBER`, and queries the existing LIRITUR Postgres database through Prisma + Gemini.

This service lives next to the Next.js app and reuses the same `DATABASE_URL` / Prisma schema. It does not replace the web UI.

## 1. Install

From the repo root:

```bash
npm install
```

That installs Baileys, Express, Gemini, and the other assistant dependencies into the main project.

## 2. Environment

Copy missing keys into `.env` (never commit this file):

```
DATABASE_URL="postgres://..."
AI_API_KEY="your-gemini-api-key"
MY_PHONE_NUMBER="9725XXXXXXXX"
ASSISTANT_PORT="3003"
```

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Same Prisma Postgres URL the web app uses |
| `AI_API_KEY` | Gemini key (`GEMINI_API_KEY` is also accepted) |
| `MY_PHONE_NUMBER` | Your personal number. `050...` or `97250...` both work |
| `GEMINI_MODEL` | Optional, default `gemini-3.6-flash` |
| `ASSISTANT_PORT` | Health server, default `3003` |

Get a Gemini key from [Google AI Studio](https://aistudio.google.com/apikey).

## 3. Run locally

```bash
npx prisma generate
npm run assistant
```

On first launch a QR code is printed in the terminal.

1. Open WhatsApp on your phone.
2. **Settings → Linked devices → Link a device**.
3. Scan the QR code.

Session files are stored in `assistant/.wa-auth/` (gitignored). After the first scan, restarts reuse that session.

Status page (Hebrew, auto-refresh): `http://localhost:3003`

JSON health: `http://localhost:3003/health`

## 4. How to talk to it

WhatsApp **cannot** read messages you send to yourself from the same account (Message yourself, or a chat with your own number). Those arrive encrypted on the linked computer and fail to decrypt.

Working options:

1. Ask on the local page: `http://localhost:3003`
2. **Recommended for WhatsApp:** link this computer to your number, then send `בוט ...` **from a different WhatsApp** to your number.

Ask in Hebrew, starting with **בוט** only on WhatsApp:

- בוט מי מגיע לאירוע הזה?
- בוט מי משובץ לראיון ב-5 בספטמבר?
- בוט אילו משימות פתוחות יש ללירי?
- בוט מה הסטטוס של מבחני מצב החודש?

The model can only read data. It cannot create, edit, or delete events.

## 5. Project files

- `assistant/src/index.ts` — Express health server + process entry
- `assistant/src/whatsapp.ts` — Baileys connection, QR, whitelist, replies
- `assistant/src/bot.ts` — Gemini prompt + tool-calling loop
- `assistant/src/tools.ts` — Safe Prisma queries (events, attendees, tasks, documents)
- `prisma/schema.prisma` — Shared schema (Event.evaluators are the attendees)

## Notes

- Unofficial WhatsApp Web clients can be rate-limited or disconnected by WhatsApp. Use this only for your own account, not for bulk messaging.
- If the session is logged out, delete `assistant/.wa-auth` and scan again.
