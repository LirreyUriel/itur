import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(process.cwd(), ".env") });

function optional(name: string, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

function required(name: string) {
  const value = optional(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadAssistantEnv() {
  const aiApiKey = optional("AI_API_KEY") || optional("GEMINI_API_KEY");
  if (!aiApiKey) {
    throw new Error("Missing required environment variable: AI_API_KEY (or GEMINI_API_KEY)");
  }

  return {
    databaseUrl: required("DATABASE_URL"),
    aiApiKey,
    myPhoneNumber: required("MY_PHONE_NUMBER"),
    geminiModel: optional("GEMINI_MODEL", "gemini-3.6-flash"),
    port: Number(optional("ASSISTANT_PORT", "3003")),
    logLevel: optional("ASSISTANT_LOG_LEVEL", "info"),
  };
}

export type AssistantEnv = ReturnType<typeof loadAssistantEnv>;
