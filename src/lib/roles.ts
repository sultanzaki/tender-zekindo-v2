import type { UserRole } from "./types";

/** Every role a profile may hold, in the order the admin UI lists them. */
export const USER_ROLES: UserRole[] = ["admin", "viewer", "restricted"];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrator",
  viewer: "Viewer",
  restricted: "Restricted",
};

export function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "viewer" || value === "restricted";
}

/** Only administrators change data. Viewer and restricted are read-only. */
export function canEdit(role: UserRole): boolean {
  return role === "admin";
}

/** OE, OE note, bid value and IDR/L, plus Analytics (built from those values).
 * Restricted users never receive these fields from the server. */
export function canViewFinancials(role: UserRole): boolean {
  return role !== "restricted";
}
