import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { Providers } from "@/components/providers";
import { ensureDbReady } from "@/lib/prisma";
import { syncOperationalData } from "@/lib/event-ops";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "איתור | מערכת ניהול פנימית",
  description: "ניהול מעריכים, אירועים, משימות ומסמכים במקום אחד",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  await ensureDbReady();
  try {
    await syncOperationalData();
  } catch (error) {
    console.error("Failed to sync operational data", error);
  }
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`} suppressHydrationWarning>
      <body className={`${heebo.className} min-h-full font-sans`}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
