import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { safeNextPath } from "../validation";
import { getSessionProfile } from "./session";
import { canViewFinancials, isUserRole } from "../roles";
import type { Profile } from "../types";

export interface AuthContext {
  userId: string;
  email: string;
  profile: Profile;
}

/**
 * Resolves the signed-in user (if any) from the session cookie. React-cached
 * so a single request only checks the session once, and soft-fails to null
 * on any error — including missing env vars, which lets routes like /login
 * and /_not-found statically prerender at build time without a database.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  try {
    const profileRow = await getSessionProfile();
    if (!profileRow || !isUserRole(profileRow.role)) return null;

    return {
      userId: profileRow.id,
      email: profileRow.email,
      profile: {
        id: profileRow.id,
        email: profileRow.email,
        name: profileRow.name,
        role: profileRow.role,
        createdAt: profileRow.created_at,
      },
    };
  } catch {
    return null;
  }
});

export async function requireUser(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) {
    const path = safeNextPath((await headers()).get("x-workspace-path") || "/");
    redirect(`/login?${new URLSearchParams({ next: path })}`);
  }
  return ctx;
}

export async function requireAdmin(): Promise<AuthContext> {
  const ctx = await requireUser();
  if (ctx.profile.role !== "admin") redirect("/");
  return ctx;
}

/** Analytics and any other page built from OE / bid values. */
export async function requireFinancialAccess(): Promise<AuthContext> {
  const ctx = await requireUser();
  if (!canViewFinancials(ctx.profile.role)) redirect("/");
  return ctx;
}
