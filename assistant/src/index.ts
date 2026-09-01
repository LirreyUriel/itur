import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import express from "express";
import { loadAssistantEnv } from "./env";
import { prisma } from "./db";
import { answerQuestion, assistantErrorMessage } from "./bot";
import {
  assistantStatus,
  getAssistantStatusView,
  recordAssistantEvent,
  startWhatsApp,
} from "./whatsapp";

const SESSION_COOKIE = "liritur_assistant";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cloudHosted() {
  return Boolean(
    process.env.RAILWAY_ENVIRONMENT ||
      process.env.FLY_APP_NAME ||
      process.env.RENDER ||
      process.env.K_SERVICE ||
      process.env.ASSISTANT_PUBLIC === "1",
  );
}

function httpPassword() {
  return (process.env.ASSISTANT_HTTP_PASSWORD || process.env.APP_PASSWORD || "").trim();
}

function cookieValue(req: IncomingMessage, name: string) {
  const header = req.headers.cookie;
  if (!header) return "";
  for (const part of header.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

function signSession(secret: string) {
  return createHmac("sha256", secret).update("ok").digest("hex");
}

function sessionValid(req: IncomingMessage, secret: string) {
  const actual = cookieValue(req, SESSION_COOKIE);
  const expected = signSession(secret);
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function loginPage(error?: string) {
  return `<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>כניסה · עוזר LIRITUR</title>
  </head>
  <body style="font-family:Heebo,Arial,sans-serif;background:#f6f1ea;margin:0;">
    <main style="max-width:22rem;margin:4rem auto;padding:0 1.25rem;">
      <h1>עוזר LIRITUR</h1>
      ${error ? `<p style="color:#a33b24;">${escapeHtml(error)}</p>` : ""}
      <form method="post" action="/login" style="background:#fff;padding:1.2rem;border-radius:1rem;">
        <label>סיסמה<br /><input name="password" type="password" required style="width:100%;margin:.5rem 0 1rem;padding:.5rem;" /></label>
        <button type="submit">כניסה</button>
      </form>
    </main>
  </body>
</html>`;
}

function statusPage() {
  const status = getAssistantStatusView();
  const event = status.lastEvent;
  const local = status.lastLocal;
  const eventKind =
    event?.kind === "answered"
      ? "נענתה"
      : event?.kind === "seen"
        ? "מטופלת עכשיו"
        : event?.kind === "error"
          ? "שגיאה"
          : event?.kind === "skipped"
            ? "דולגה"
            : "עדיין אין הודעה";
  const qrSrc = status.qr
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(status.qr)}`
    : "";

  return `<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="${status.qr ? "8" : "30"}" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>מצב העוזר · LIRITUR</title>
    <style>
      :root { color-scheme: light; }
      body {
        font-family: Heebo, Arial, sans-serif;
        margin: 0;
        background: #f6f1ea;
        color: #1f1a16;
      }
      main {
        max-width: 40rem;
        margin: 2.5rem auto;
        padding: 0 1.25rem 3rem;
      }
      h1 { font-size: 1.5rem; margin: 0 0 0.35rem; }
      p.lead { color: #5c534c; margin: 0 0 1.5rem; }
      .card {
        background: #fff;
        border-radius: 1rem;
        padding: 1.15rem 1.25rem;
        box-shadow: 0 8px 24px rgb(31 26 22 / 8%);
        margin-bottom: 1rem;
      }
      .ok { color: #1f7a4d; font-weight: 700; }
      .bad { color: #a33b24; font-weight: 700; }
      .muted { color: #6d645c; font-size: 0.92rem; }
      dt { font-weight: 700; margin-top: 0.75rem; }
      dd { margin: 0.2rem 0 0; }
      code { font-size: 0.9em; }
      textarea, button { font: inherit; }
      textarea {
        width: 100%;
        min-height: 5.5rem;
        box-sizing: border-box;
        border: 1px solid #d9cfc4;
        border-radius: 0.7rem;
        padding: 0.7rem 0.8rem;
        resize: vertical;
      }
      button {
        margin-top: 0.7rem;
        background: #1f1a16;
        color: #fff;
        border: 0;
        border-radius: 999px;
        padding: 0.55rem 1.1rem;
        cursor: pointer;
      }
      button:disabled { opacity: 0.55; cursor: wait; }
      #answer { white-space: pre-wrap; margin-top: 0.9rem; }
      .qr { display: block; margin: 0.8rem auto; background: #fff; padding: 0.6rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>מצב העוזר</h1>
      <p class="lead">אפשר לשאול כאן עכשיו. בוואטסאפ זה עובד רק אם שולחים <strong>מחשבון אחר</strong> אל המספר שלך — לא מהטלפון אל עצמך.</p>
      ${
        qrSrc
          ? `<section class="card"><p class="bad">ממתין לסריקת QR</p><img class="qr" alt="QR" src="${escapeHtml(qrSrc)}" width="240" height="240" /><p class="muted">וואטסאפ → הגדרות → מכשירים מקושרים → קישור מכשיר</p></section>`
          : ""
      }
      <section class="card">
        <form id="ask">
          <label for="q"><strong>שאלה ל־LIRITUR</strong></label>
          <textarea id="q" name="q" required placeholder="מי מגיע לראיון הבא?"></textarea>
          <button type="submit">שאלי</button>
        </form>
        <div id="answer">${local ? `<p class="muted">${escapeHtml(local.question)}</p><p>${escapeHtml(local.reply)}</p>` : ""}</div>
      </section>
      <section class="card">
        <p class="${status.ok ? "ok" : "bad"}">${escapeHtml(status.whatsappLabel)}</p>
        <dl>
          <dt>הופעל</dt>
          <dd class="muted">${escapeHtml(status.startedAt)}</dd>
          <dt>חובר לוואטסאפ</dt>
          <dd class="muted">${escapeHtml(status.connectedAt || "עדיין לא")}</dd>
          <dt>הודעה אחרונה בוואטסאפ</dt>
          <dd>${escapeHtml(eventKind)}</dd>
          <dd>${escapeHtml(event?.detail || "לא התקבלה עדיין הודעה שהעוזר טיפל בה.")}</dd>
          ${event?.preview ? `<dd class="muted">תצוגה: ${escapeHtml(event.preview)}</dd>` : ""}
          ${event?.at ? `<dd class="muted">${escapeHtml(event.at)}</dd>` : ""}
          ${status.lastError ? `<dt>שגיאה אחרונה</dt><dd class="bad">${escapeHtml(status.lastError)}</dd>` : ""}
        </dl>
      </section>
      <section class="card muted">
        <p>צ'אט עם המספר שלך מאותו חשבון הוא עדיין «הודעה לעצמי». וואטסאפ מצפין אותה כך שהמכשיר המקושר לא יכול לקרוא.</p>
        <p>כדי לקבל תשובות בוואטסאפ: חשבון שני שולח אליך, והעוזר מחובר למספר שלך.</p>
      </section>
    </main>
    <script>
      const form = document.getElementById("ask");
      const box = document.getElementById("q");
      const out = document.getElementById("answer");
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const q = box.value.trim();
        if (!q) return;
        const button = form.querySelector("button");
        button.disabled = true;
        out.textContent = "מחפשת…";
        try {
          const res = await fetch("/ask", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ q }),
          });
          const data = await res.json();
          out.textContent = data.reply || data.error || "אין תשובה";
        } catch (err) {
          out.textContent = "לא הצלחתי לשאול עכשיו. בדקי שהעוזר רץ.";
        } finally {
          button.disabled = false;
        }
      });
    </script>
  </body>
</html>`;
}

async function main() {
  const env = loadAssistantEnv();
  await prisma.$connect();
  const gate = cloudHosted();
  const password = httpPassword();
  if (gate && !password) {
    throw new Error("Cloud assistant requires APP_PASSWORD or ASSISTANT_HTTP_PASSWORD");
  }

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.get("/health", (_req, res) => {
    res.json({
      ok: assistantStatus.connection === "open" || assistantStatus.connection === "qr",
      service: "liritur-assistant",
      whatsapp: assistantStatus.connection,
    });
  });

  app.get("/login", (_req, res) => {
    res.type("html").send(loginPage());
  });
  app.post("/login", (req, res) => {
    if (!gate) {
      res.redirect("/");
      return;
    }
    const given = String(req.body?.password ?? "");
    if (given !== password) {
      res.status(401).type("html").send(loginPage("סיסמה שגויה"));
      return;
    }
    res.cookie(SESSION_COOKIE, signSession(password), {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: "/",
    });
    res.redirect("/");
  });

  if (gate) {
    app.use((req, res, next) => {
      if (req.path === "/health" || req.path === "/login") {
        next();
        return;
      }
      if (sessionValid(req, password)) {
        next();
        return;
      }
      if (req.path === "/ask") {
        res.status(401).json({ ok: false, error: "נדרשת התחברות" });
        return;
      }
      res.redirect("/login");
    });
  }

  app.get("/", (_req, res) => {
    res.type("html").send(statusPage());
  });
  app.post("/ask", async (req, res) => {
    const question = String(req.body?.q ?? "").trim();
    if (!question) {
      res.status(400).json({ ok: false, error: "חסרה שאלה" });
      return;
    }
    try {
      recordAssistantEvent("seen", "שאלה מהדף המקומי", question.slice(0, 80));
      const reply = await answerQuestion(question, env);
      assistantStatus.lastLocal = {
        at: new Date().toISOString(),
        question,
        reply,
      };
      recordAssistantEvent("answered", "נענתה בדף המקומי", question.slice(0, 80));
      res.json({ ok: true, reply });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      assistantStatus.lastError = message;
      recordAssistantEvent("error", message, question.slice(0, 80));
      const reply = assistantErrorMessage(error);
      res.status(503).json({ ok: false, error: reply, reply });
    }
  });

  const server = app.listen(env.port, "0.0.0.0", () => {
    console.log(`Assistant status: http://localhost:${env.port}`);
    console.log(`Assistant health: http://localhost:${env.port}/health`);
  });
  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `פורט ${env.port} תפוס — העוזר כבר רץ. פתחי http://localhost:${env.port} (אין צורך להריץ שוב npm run assistant).`,
      );
      process.exit(1);
    }
    console.error(error);
    process.exit(1);
  });

  await startWhatsApp(env);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

function shutdown() {
  void prisma.$disconnect().finally(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
