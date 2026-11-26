import { requireUser } from "@/lib/auth/dal";
import { supabaseServer } from "@/lib/supabase-server";
import { PageHeading } from "@/components/PageHeading";
import { SecurityClient } from "@/components/SecurityClient";
import workspace from "@/components/Workspace.module.css";

export const dynamic = "force-dynamic";

export default async function AccountSecurityPage() {
  const ctx = await requireUser();
  const { data } = await supabaseServer()
    .from("profiles")
    .select("totp_enabled_at, totp_recovery_hashes")
    .eq("id", ctx.userId)
    .maybeSingle();
  return (
    <section className={workspace.page}>
      <PageHeading
        eyebrow="ACCOUNT"
        title="Account security"
        description="Add a second step to signing in. Optional, and it only affects your own account."
      />
      <SecurityClient
        enabledAt={data?.totp_enabled_at ?? null}
        recoveryLeft={data?.totp_recovery_hashes?.length ?? 0}
      />
    </section>
  );
}
