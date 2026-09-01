"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  CheckSquare,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Table2,
  Users,
} from "lucide-react";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "סקירה", icon: LayoutDashboard },
  { href: "/evaluators", label: "מעריכים", icon: Users },
  { href: "/events", label: "אירועים", icon: CalendarDays },
  { href: "/summary", label: "סיכום חודשי", icon: Table2 },
  { href: "/tasks", label: "משימות", icon: CheckSquare },
  { href: "/notes", label: "מסמכים", icon: FileText },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <nav className="flex flex-1 flex-col gap-1">
      {navItems.map((item) => {
        const active =
          mounted &&
          (item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`));
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-white/16 text-white shadow-inner"
                : "text-white/75 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="mb-8 px-1">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-[#A5D6A7] text-sm font-bold text-[#1B5E20]">
          LI
        </div>
        <div>
            <p className="text-base font-semibold tracking-tight text-white">LIRITUR</p>
          <p className="text-xs text-white/55">מערכת ניהול פנימית</p>
        </div>
      </div>
    </div>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <Brand />
      <NavLinks onNavigate={onNavigate} />
      <div className="mt-auto space-y-3 pt-6">
        <form action={logout}>
          <Button
            type="submit"
            variant="ghost"
            className="w-full justify-start text-white/75 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-4" />
            יציאה
          </Button>
        </form>
        <p className="text-[11px] leading-5 text-white/40">
          הנתונים נשמרים מקומית בתיקיית data ומגובים אוטומטית. שום דבר לא נמחק בלי מחיקה מפורשת.
        </p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 bg-[#07180C] p-5 lg:flex lg:flex-col">
        <SidebarBody />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/70 bg-[#E8F5E9]/90 px-4 py-3 backdrop-blur lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="תפריט">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-0 bg-[#07180C] p-5 text-white [&>button]:text-white">
              <SheetTitle className="sr-only">ניווט</SheetTitle>
              <SidebarBody onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <span className="text-sm font-semibold">LIRITUR</span>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
