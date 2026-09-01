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
| `ASSISTANT_PORT` / `PORT` | Health server. Cloud hosts set `PORT`. Default `3003` |
| `WA_AUTH_DIR` | Optional folder for the WhatsApp session. Use a persistent volume in the cloud |

Get a Gemini key from [Google AI Studio](https://aistudio.google.com/apikey).

## 3. Run locally

```bash
npx prisma generate
npm run assistant
```

If you see `פורט 3003 תפוס`, the assistant is **already running**. Open [http://localhost:3003](http://localhost:3003) instead of starting a second copy.

On first launch a QR code is printed in the terminal (and on the status page).

1. Open WhatsApp on your phone.
2. **Settings → Linked devices → Link a device**.
3. Scan the QR code.

Session files are stored in `assistant/.wa-auth/` (gitignored). After the first scan, restarts reuse that session.

Status page: `http://localhost:3003`

JSON health: `http://localhost:3003/health`

## 3b. Keep it running 24/7 (Railway)

Vercel cannot run this bot: it needs a process that stays connected to WhatsApp. Use a small always-on host such as [Railway](https://railway.app).

1. Create a Railway project from this GitHub repo (`LirreyUriel/itur`).
2. Set start/build from `railway.toml` (Dockerfile.assistant).
3. Add a **volume** mounted at `/data`.
4. Set variables:

```
DATABASE_URL=  (same Prisma Postgres URL as Vercel)
AI_API_KEY=
MY_PHONE_NUMBER=
APP_PASSWORD=
WA_AUTH_DIR=/data/wa-auth
ASSISTANT_PUBLIC=1
```

5. Open the Railway public URL, sign in with `APP_PASSWORD`, scan the QR if shown.
6. Stop `npm run assistant` on your PC — WhatsApp allows one linked session like this; two copies fight each other.

Cloud IPs are sometimes blocked by WhatsApp. If the session keeps dropping, the reliable option is a machine at home that stays on.

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
