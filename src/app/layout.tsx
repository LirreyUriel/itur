import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { headers } from "next/headers";
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
  title: "LIRITUR",
  description: "ניהול מעריכים, אירועים, משימות ומסמכים במקום אחד",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const isLogin = (await headers()).get("x-itur-login") === "1";
  if (!isLogin) {
    await ensureDbReady();
    try {
      await syncOperationalData();
    } catch (error) {
      console.error("Failed to sync operational data", error);
    }
  }
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`} suppressHydrationWarning>
      <body className={`${heebo.className} min-h-full font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
