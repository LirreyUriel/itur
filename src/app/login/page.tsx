import { LoginForm } from "@/components/login-form";
import { safeRedirectPath } from "@/lib/auth";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const from = safeRedirectPath(typeof params.from === "string" ? params.from : "/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#E8F5E9] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border/80 bg-card p-6 shadow-[0_12px_32px_rgba(21,32,51,0.08)]">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#C8E6C9] text-sm font-bold text-[#1B5E20]">
            LI
          </div>
          <div>
            <p className="text-base font-semibold tracking-tight">LIRITUR</p>
            <p className="text-xs text-muted-foreground">יש להזין סיסמה כדי להיכנס</p>
          </div>
        </div>
        <LoginForm from={from} />
      </div>
    </div>
  );
}
