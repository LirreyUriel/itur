export const SESSION_COOKIE = "itur_session";

const SESSION_DAYS = 30;
const PASSWORD_SHA256 =
  "d2abbe5c15c6f14e5584d541dd5e436c13c43ed6e5dfd62560658a90dc41c003";

function toHex(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return [...view].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(digest);
}

async function hmacHex(secret: string, data: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return toHex(signature);
}

function envValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value) return "";
  return value.replace(/^["']|["']$/g, "").trim();
}

async function expectedPasswordHash() {
  const fromEnv = envValue("APP_PASSWORD");
  return fromEnv ? sha256Hex(fromEnv) : PASSWORD_SHA256;
}

async function sessionSecret() {
  const fromEnv = envValue("APP_SESSION_SECRET");
  if (fromEnv) return fromEnv;
  return `itur:${await expectedPasswordHash()}`;
}

export async function passwordMatches(password: string) {
  const [actual, expected] = await Promise.all([sha256Hex(password), expectedPasswordHash()]);
  return timingSafeEqual(actual, expected);
}

export async function createSessionValue() {
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = String(expiresAt);
  return `${payload}.${await hmacHex(await sessionSecret(), payload)}`;
}

export async function isSessionValid(token: string | undefined) {
  if (!token) return false;
  const separator = token.indexOf(".");
  if (separator < 1) return false;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!signature) return false;
  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = await hmacHex(await sessionSecret(), payload);
  return timingSafeEqual(signature, expected);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

export function safeRedirectPath(value: unknown) {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  if (value.startsWith("/login")) return "/";
  return value;
}
