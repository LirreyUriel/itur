"use client";

import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider delayDuration={180}>
        {children}
        <Toaster dir="rtl" position="top-center" richColors closeButton />
      </TooltipProvider>
    </ThemeProvider>
  );
}
