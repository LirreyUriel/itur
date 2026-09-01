import path from "node:path";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  type WAMessage,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import qrcode from "qrcode-terminal";
import { answerQuestion, assistantErrorMessage } from "./bot";
import type { AssistantEnv } from "./env";
import { isAllowedSender, isGroupJid, isOwnChat, isStatusJid } from "./phone";

const CONNECTION_LABELS: Record<AssistantStatus["connection"], string> = {
  connecting: "מתחבר לוואטסאפ…",
  qr: "ממתין לסריקת QR במכשיר מקושר",
  open: "מחובר לוואטסאפ",
  close: "מנותק מוואטסאפ",
};

const DECRYPT_HINT =
  "וואטסאפ לא נותן למכשיר המקושר לקרוא הודעות שכתבת לעצמך מאותו חשבון — גם בצ'אט עם המספר שלך. שאלי בדף המקומי, או שלחי מחשבון וואטסאפ אחר אל המספר שלך.";

export type AssistantStatus = {
  connection: "connecting" | "qr" | "open" | "close";
  startedAt: string;
  connectedAt?: string;
  lastError?: string;
  lastEvent?: {
    at: string;
    kind: "seen" | "skipped" | "answered" | "error";
    detail: string;
    preview?: string;
  };
  lastLocal?: {
    at: string;
    question: string;
    reply: string;
  };
};

const processedIds = new Set<string>();
let reconnectTimer: NodeJS.Timeout | null = null;
let ownId: string | null = null;
let ownLid: string | null = null;

export const assistantStatus: AssistantStatus = {
  connection: "connecting",
  startedAt: new Date().toISOString(),
};

export function getAssistantStatusView() {
  return {
    ok: assistantStatus.connection === "open",
    service: "liritur-assistant",
    whatsapp: assistantStatus.connection,
    whatsappLabel: CONNECTION_LABELS[assistantStatus.connection],
    startedAt: assistantStatus.startedAt,
    connectedAt: assistantStatus.connectedAt,
    lastError: assistantStatus.lastError,
    lastEvent: assistantStatus.lastEvent,
    lastLocal: assistantStatus.lastLocal,
  };
}

export function recordAssistantEvent(
  kind: NonNullable<AssistantStatus["lastEvent"]>["kind"],
  detail: string,
  preview?: string,
) {
  note(kind, detail, preview);
}

function note(
  kind: NonNullable<AssistantStatus["lastEvent"]>["kind"],
  detail: string,
  preview?: string,
) {
  assistantStatus.lastEvent = {
    at: new Date().toISOString(),
    kind,
    detail,
    preview,
  };
}

function logger(
  level: string,
  onDecryptFailed?: (remoteJid: string | undefined, fromMe: boolean) => void,
) {
  return pino({
    level,
    hooks: {
      logMethod(args, method) {
        const payload =
          typeof args[0] === "object" && args[0]
            ? (args[0] as { msg?: string; key?: { remoteJid?: string; fromMe?: boolean } })
            : undefined;
        const msg =
          payload?.msg ||
          (typeof args[0] === "string" ? args[0] : undefined) ||
          (typeof args[1] === "string" ? args[1] : undefined);
        if (msg === "failed to decrypt message") {
          onDecryptFailed?.(payload?.key?.remoteJid, Boolean(payload?.key?.fromMe));
        }
        return method.apply(this, args);
      },
    },
  });
}

function isRecentMessage(message: WAMessage) {
  const raw = Number(message.messageTimestamp);
  if (!Number.isFinite(raw) || raw <= 0) return true;
  const ms = raw > 1e12 ? raw : raw * 1000;
  return Date.now() - ms < 3 * 60 * 1000;
}

function messageText(message: WAMessage) {
  const body = message.message;
  if (!body) return "";
  return (
    body.conversation ||
    body.extendedTextMessage?.text ||
    body.imageMessage?.caption ||
    body.videoMessage?.caption ||
    body.documentMessage?.caption ||
    body.buttonsResponseMessage?.selectedDisplayText ||
    body.listResponseMessage?.title ||
    ""
  ).trim();
}

/** Only messages that start with "בוט" are treated as questions. */
export function asBotQuestion(text: string) {
  const match = text.match(/^בוט(?:[:\-–—,.]|\s+|$)/u);
  if (!match) return null;
  return text.slice(match[0].length).trim();
}

function remember(id: string) {
  processedIds.add(id);
  if (processedIds.size > 500) {
    const first = processedIds.values().next().value;
    if (first) processedIds.delete(first);
  }
}

export async function startWhatsApp(env: AssistantEnv) {
  const log = logger(env.logLevel, (remoteJid, fromMe) => {
    if (!fromMe || isGroupJid(remoteJid) || isStatusJid(remoteJid)) return;
    note("skipped", DECRYPT_HINT);
  });
  const authDir = path.resolve(process.cwd(), "assistant", ".wa-auth");
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: log,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, log),
    },
    browser: Browsers.macOS("LIRITUR"),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  sock.ev.process(async (events) => {
    if (events["creds.update"]) {
      await saveCreds();
    }

    if (events["connection.update"]) {
      const { connection, lastDisconnect, qr } = events["connection.update"];
      if (qr) {
        assistantStatus.connection = "qr";
        console.log("\nScan this QR code in WhatsApp → Linked devices:\n");
        qrcode.generate(qr, { small: true });
      }
      if (connection === "open") {
        assistantStatus.connection = "open";
        assistantStatus.connectedAt = new Date().toISOString();
        assistantStatus.lastError = undefined;
        ownId = sock.user?.id ?? null;
        ownLid = sock.user?.lid ?? null;
        console.log("WhatsApp connected.");
      }
      if (connection === "close") {
        assistantStatus.connection = "close";
        const error = lastDisconnect?.error as Boom | undefined;
        const statusCode = error?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        assistantStatus.lastError = error?.message || "connection closed";
        if (loggedOut) {
          console.error("WhatsApp logged out. Delete assistant/.wa-auth and scan again.");
          return;
        }
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            void startWhatsApp(env);
          }, 4000);
        }
      }
    }

    if (events["messages.upsert"]) {
      const { messages } = events["messages.upsert"];

      for (const msg of messages) {
        const id = msg.key.id;
        if (!id || processedIds.has(id) || !isRecentMessage(msg)) continue;
        remember(id);

        const remoteJid = msg.key.remoteJid;
        if (!remoteJid) continue;

        const allowed = isAllowedSender({
          myPhone: env.myPhoneNumber,
          remoteJid,
          participant: msg.key.participant,
          fromMe: Boolean(msg.key.fromMe),
          ownId: sock.user?.id ?? ownId,
          ownLid: sock.user?.lid ?? ownLid,
        });

        if (!msg.message) {
          const ownChat = isOwnChat({
            remoteJid,
            myPhone: env.myPhoneNumber,
            ownId: sock.user?.id ?? ownId,
            ownLid: sock.user?.lid ?? ownLid,
          });
          if (allowed || ownChat || msg.key.fromMe) {
            note("skipped", DECRYPT_HINT);
          }
          continue;
        }

        if (!allowed) continue;

        const text = messageText(msg);
        const question = asBotQuestion(text);
        if (question === null) {
          const ownChat = isOwnChat({
            remoteJid,
            myPhone: env.myPhoneNumber,
            ownId: sock.user?.id ?? ownId,
            ownLid: sock.user?.lid ?? ownLid,
          });
          if (ownChat) {
            note("skipped", "ההודעה לא מתחילה במילה בוט — התעלמתי.", text.slice(0, 80));
          }
          continue;
        }

        try {
          note("seen", "קיבלתי שאלת בוט, מחפשת תשובה...", question.slice(0, 80) || "בוט");
          await sock.sendPresenceUpdate("composing", remoteJid);
          const reply = question
            ? await answerQuestion(question, env)
            : "שאלי אחרי המילה בוט, למשל:\nבוט מי מגיע לראיון הבא?";
          await sock.sendMessage(remoteJid, { text: reply }, { quoted: msg });
          note("answered", "נשלחה תשובה.", question.slice(0, 80) || "בוט");
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown error";
          log.error({ err: error }, "failed to answer WhatsApp message");
          await sock.sendMessage(
            remoteJid,
            { text: assistantErrorMessage(error) },
            { quoted: msg },
          );
          assistantStatus.lastError = message;
          note("error", message, question.slice(0, 80));
        } finally {
          await sock.sendPresenceUpdate("paused", remoteJid).catch(() => undefined);
        }
      }
    }
  });

  return sock;
}
