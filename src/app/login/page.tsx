import { safeNextPath } from "@/lib/validation";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/dal";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next, reason } = await searchParams;
  const safeNext = safeNextPath(next);

  // A real DB-backed check, not just cookie presence (that's what proxy.ts
  // does, cheaply) — matters because a session can be revoked (e.g. an
  // admin password reset) while its cookie is still sitting in the
  // browser. Redirecting away from /login on cookie presence alone would
  // bounce a signed-out-but-still-cookied visitor straight back here from
  // every protected page, an infinite loop.
  const ctx = await getAuthContext();
  if (ctx) redirect(safeNext);

  const notice =
    reason === "idle"
      ? "You were signed out after 60 minutes of inactivity."
      : reason === "expired"
        ? "Your session ended. Please sign in again."
        : undefined;
  return <LoginForm next={safeNext} notice={notice} />;
}
