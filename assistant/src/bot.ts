import { GoogleGenerativeAI, type Content, type Part } from "@google/generative-ai";
import { executeTool, toolDeclarations } from "./tools";
import { todayIso, truncate } from "./format";
import type { AssistantEnv } from "./env";

const SYSTEM_PROMPT = `אתה עוזר אישי פרטי של מערכת LIRITUR.
את עונה רק בעברית, קצר וברור, לפי נתונים אמיתיים ממסד הנתונים.

מבנה הנתונים:
- Event: אירוע. השדה notes הוא שם האירוע (ריאיון, כנס חבצלות, מבחני מצב או שם חופשי). date הוא התאריך. status: אושר / בתהליך / נדחה / לא ביקשתי. evaluators הם האנשים המשובצים לאירוע (המשתתפים).
- Evaluator: מעריך. name, roles (מראיין / מנהל תרגיל), year, tz (ת.ז), ma (מ.א), email, relevantTo2026.
- Task: משימה. title, status (לביצוע / בטיפול / בוצע), assignee, dueDate, יכולה להיות מקושרת לאירוע.
- Document / Folder: מסמכים שנשמרו במערכת.

כללים:
- תמיד שלפי כלים כדי לשלוף נתונים לפני תשובה עובדתית. אל תמציאי שמות, תאריכים או שיבוצים.
- אם חסר הקשר ("האירוע הזה"), חפשי אירועים קרובים והציגי את המועמדים או שאלי איזה אירוע.
- היום לפי שעון ישראל הוא {{TODAY}}.
- תשובה קצרה: תאריך, שם אירוע, שמות האנשים. בלי JSON.
- אם אין תוצאות, אמרי זאת במפורש.`;

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorStatus(error: unknown) {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number") return status;
  }
  return undefined;
}

export function isRetryableAiError(error: unknown) {
  const status = errorStatus(error);
  const message = error instanceof Error ? error.message : String(error);
  return (
    status === 429 ||
    status === 503 ||
    /503|429|high demand|unavailable|overloaded|try again later/i.test(message)
  );
}

export function isMissingModelError(error: unknown) {
  const status = errorStatus(error);
  const message = error instanceof Error ? error.message : String(error);
  return status === 404 || /404|not found|not supported/i.test(message);
}

export function assistantErrorMessage(error: unknown) {
  if (isRetryableAiError(error)) {
    return "שירות התשובות של Google עמוס כרגע. נסי שוב בעוד כמה שניות.";
  }
  if (isMissingModelError(error)) {
    return "מודל הבינה לא זמין כרגע. נסי שוב בעוד רגע.";
  }
  return "לא הצלחתי לענות עכשיו. נסי שוב בעוד רגע.";
}

function modelCandidates(preferred: string) {
  return [
    ...new Set(
      [
        preferred,
        "gemini-3.5-flash-lite",
        "gemini-2.5-flash",
        "gemini-flash-latest",
        "gemini-2.0-flash",
      ].filter(Boolean),
    ),
  ];
}

async function generateContent(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  contents: Content[],
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await model.generateContent({ contents });
    } catch (error) {
      lastError = error;
      if (isMissingModelError(error) || !isRetryableAiError(error) || attempt === 2) {
        throw error;
      }
      await sleep(700 * (attempt + 1));
    }
  }
  throw lastError;
}

async function answerWithModel(question: string, env: AssistantEnv, modelName: string) {
  const genAI = new GoogleGenerativeAI(env.aiApiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_PROMPT.replace("{{TODAY}}", todayIso()),
    tools: [{ functionDeclarations: toolDeclarations }],
  });

  const contents: Content[] = [
    {
      role: "user",
      parts: [{ text: question }],
    },
  ];

  for (let round = 0; round < 6; round += 1) {
    const result = await generateContent(model, contents);
    const candidate = result.response.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const functionCalls = parts.filter((part) => part.functionCall);

    if (functionCalls.length === 0) {
      const text = result.response.text().trim();
      return truncate(text || "לא הצלחתי לגבש תשובה מהנתונים.");
    }

    contents.push({ role: "model", parts });

    const toolParts: Part[] = [];
    for (const part of functionCalls) {
      const call = part.functionCall;
      if (!call?.name) continue;
      const output = await executeTool(call.name, asRecord(call.args));
      toolParts.push({
        functionResponse: {
          name: call.name,
          response: asRecord(output),
        },
      });
    }
    contents.push({ role: "user", parts: toolParts });
  }

  return "השאלה דרשה יותר מדי שלבי חיפוש. נסי לנסח ממוקד יותר, למשל עם תאריך או שם אירוע.";
}

export async function answerQuestion(question: string, env: AssistantEnv) {
  let lastError: unknown;
  for (const modelName of modelCandidates(env.geminiModel)) {
    try {
      const reply = await answerWithModel(question, env, modelName);
      if (modelName !== env.geminiModel) {
        console.log(`Gemini fallback model: ${modelName}`);
      }
      return reply;
    } catch (error) {
      lastError = error;
      if (isMissingModelError(error) || isRetryableAiError(error)) {
        console.warn(
          `Gemini ${modelName} failed (${error instanceof Error ? error.message : "error"}), trying next model.`,
        );
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}
