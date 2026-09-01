"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  createSessionValue,
  passwordMatches,
  safeRedirectPath,
  sessionCookieOptions,
} from "@/lib/auth";

export type LoginState = { error?: string } | undefined;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  if (!(await passwordMatches(password))) {
    return { error: "סיסמה שגויה" };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await createSessionValue(), sessionCookieOptions());
  redirect(safeRedirectPath(formData.get("from")));
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}
