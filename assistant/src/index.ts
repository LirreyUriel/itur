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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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

  return `<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="utf-8" />
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
      textarea, button {
        font: inherit;
      }
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
    </style>
  </head>
  <body>
    <main>
      <h1>מצב העוזר</h1>
      <p class="lead">אפשר לשאול כאן עכשיו. בוואטסאפ זה עובד רק אם שולחים <strong>מחשבון אחר</strong> אל המספר שלך — לא מהטלפון אל עצמך.</p>
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
        <p>צ'אט עם המספר שלך מאותו חשבון הוא עדיין «הודעה לעצמי». וואטסאפ מצפין אותה כך שהמחשב המקושר לא יכול לקרוא.</p>
        <p>כדי לקבל תשובות בוואטסאפ: חשבון שני (סימה אחרת / וואטסאפ עסקי) שולח אליך, והעוזר מחובר למספר שלך.</p>
        <p>JSON: <a href="/health">/health</a></p>
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

  const app = express();
  app.use(express.json());
  app.get("/", (_req, res) => {
    res.type("html").send(statusPage());
  });
  app.get("/health", (_req, res) => {
    res.json(getAssistantStatusView());
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

  app.listen(env.port, () => {
    console.log(`Assistant status: http://localhost:${env.port}`);
    console.log(`Assistant health: http://localhost:${env.port}/health`);
  });

  await startWhatsApp(env);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

process.on("SIGINT", () => {
  void prisma.$disconnect().finally(() => process.exit(0));
});
