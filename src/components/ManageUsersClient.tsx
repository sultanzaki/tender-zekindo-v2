"use client";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createUser,
  removeUser,
  resetUserTwoFactor,
  resetUserPassword,
  updateUserRole,
} from "@/lib/auth/actions";
import type { Profile, UserRole } from "@/lib/types";
import { PageHeading } from "./PageHeading";
import { Modal } from "./Modal";
import styles from "./Workspace.module.css";
import members from "./MemberTable.module.css";
export function ManageUsersClient({
  users,
  currentUserId,
}: {
  users: Profile[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, start] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [target, setTarget] = useState<{
    user: Profile;
    action: "reset" | "remove";
  } | null>(null);
  const [password, setPassword] = useState("");
  const [draft, setDraft] = useState({
    name: "",
    email: "",
    password: "",
    role: "viewer" as UserRole,
  });
  const filtered = users.filter((u) =>
    `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()),
  );
  function run(
    fn: () => Promise<{ error?: string } | undefined>,
    success: string,
    done?: () => void,
  ) {
    setError("");
    setNotice("");
    start(async () => {
      try {
        const result = await fn();
        if (result?.error) {
          setError(result.error);
          return;
        }
        setNotice(success);
        done?.();
        router.refresh();
      } catch {
        setError(
          "The change could not be saved. Please check your connection and try again.",
        );
      }
    });
  }
  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow="ADMINISTRATION"
        title="Users & access"
        description="Manage accounts, permissions, and password resets."
        actions={
          <Button
            variant="default"
            onClick={() => {
              setError("");
              setCreateOpen(true);
            }}
          >
            Create user
          </Button>
        }
      />
      <div className={styles.metrics}>
        {[
          ["Total accounts", users.length],
          ["Administrators", users.filter((u) => u.role === "admin").length],
          ["Viewers", users.filter((u) => u.role === "viewer").length],
          ["Restricted", users.filter((u) => u.role === "restricted").length],
        ].map(([label, value]) => (
          <div key={label} className={styles.metric}>
            <span className={styles.metricLabel}>{label}</span>
            <strong className={styles.metricValue}>{value}</strong>
          </div>
        ))}
      </div>
      {notice && (
        <p className="feedback feedback-success" role="status">
          {notice}
        </p>
      )}
      {error && !createOpen && !target && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Card className={`${styles.panel} gap-0 py-0`}>
        <div className={`${styles.panelHead} ${members.head}`}>
          <h2>Workspace members</h2>
          <Input
            type="search"
            aria-label="Search users"
            className="control"
            style={{ maxWidth: 280 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email"
          />
        </div>
        <div className={styles.tableWrap}>
          <Table className={`${styles.table} ${members.members}`}>
            <TableHeader>
              <TableRow>
                <TableHead>Name & email</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <strong>{u.name}</strong>
                    {u.id === currentUserId && (
                      <span className="muted"> · You</span>
                    )}
                    <div className="muted">
                      {u.email}
                      {u.twoFactor && " · 2FA on"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <NativeSelect
                      className={`control ${members.roleSelect}`}
                      aria-label={`Role for ${u.name}`}
                      value={u.role}
                      disabled={pending || u.id === currentUserId}
                      onChange={(e) =>
                        run(
                          () =>
                            updateUserRole(u.id, e.target.value as UserRole),
                          `Access updated for ${u.name}.`,
                        )
                      }
                    >
                      <NativeSelectOption value="viewer">
                        Viewer
                      </NativeSelectOption>
                      <NativeSelectOption value="restricted">
                        Restricted
                      </NativeSelectOption>
                      <NativeSelectOption value="admin">
                        Admin
                      </NativeSelectOption>
                    </NativeSelect>
                  </TableCell>
                  <TableCell>
                    <div className={`heading-actions ${members.actions}`}>
                      <Button
                        variant="outline"
                        disabled={pending}
                        onClick={() => {
                          setError("");
                          setPassword("");
                          setTarget({ user: u, action: "reset" });
                        }}
                      >
                        Reset password
                      </Button>
                      {u.twoFactor && u.id !== currentUserId && (
                        <Button
                          variant="outline"
                          disabled={pending}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Turn off two-factor for ${u.name}? They will be signed out and can enrol again.`,
                              )
                            )
                              run(
                                () => resetUserTwoFactor(u.id),
                                `Two-factor reset for ${u.name}.`,
                              );
                          }}
                        >
                          Reset 2FA
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        className={members.removeButton}
                        disabled={pending || u.id === currentUserId}
                        onClick={() => {
                          setError("");
                          setTarget({ user: u, action: "remove" });
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {!filtered.length && (
          <p className={styles.empty}>No accounts match this search.</p>
        )}
      </Card>
      <Modal
        open={createOpen}
        title="Create workspace account"
        onClose={() => {
          if (!pending) {
            setCreateOpen(false);
            setDraft({ ...draft, password: "" });
          }
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => createUser(draft),
              "Account created. Share the initial password securely with the user.",
              () => {
                setCreateOpen(false);
                setDraft({ name: "", email: "", password: "", role: "viewer" });
              },
            );
          }}
        >
          <div className="form-stack">
            <Label className="field">
              Name
              <Input
                className="control"
                autoComplete="name"
                required
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Label>
            <Label className="field">
              Email
              <Input
                className="control"
                autoComplete="email"
                type="email"
                required
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </Label>
            <Label className="field">
              Initial password
              <Input
                className="control"
                autoComplete="new-password"
                type="password"
                minLength={8}
                required
                value={draft.password}
                onChange={(e) =>
                  setDraft({ ...draft, password: e.target.value })
                }
              />
            </Label>
            <Label className="field">
              Role
              <NativeSelect
                className="control"
                value={draft.role}
                onChange={(e) =>
                  setDraft({ ...draft, role: e.target.value as UserRole })
                }
              >
                <NativeSelectOption value="viewer">
                  Viewer · read-only
                </NativeSelectOption>
                <NativeSelectOption value="restricted">
                  Restricted · read-only, no OE, bid values or Analytics
                </NativeSelectOption>
                <NativeSelectOption value="admin">
                  Admin · manage all tenders and users
                </NativeSelectOption>
              </NativeSelect>
            </Label>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="dialog-actions">
            <Button variant="default" type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create user"}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={target !== null}
        title={
          target?.action === "reset"
            ? `Reset password for ${target.user.name}`
            : `Remove ${target?.user.name}?`
        }
        onClose={() => {
          if (!pending) {
            setTarget(null);
            setPassword("");
          }
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!target) return;
            const selected = target;
            run(
              () =>
                selected.action === "reset"
                  ? resetUserPassword(selected.user.id, password)
                  : removeUser(selected.user.id),
              selected.action === "reset"
                ? "Password updated. Existing sessions were revoked."
                : "Account removed.",
              () => {
                setTarget(null);
                setPassword("");
              },
            );
          }}
        >
          <p className="muted">
            {target?.action === "reset"
              ? "The user will be signed out on all devices. Share the new password securely."
              : "This account will lose access immediately. Existing tender records are retained."}
          </p>
          {target?.action === "reset" && (
            <Label className="field">
              New password
              <Input
                type="password"
                className="control"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Label>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="dialog-actions">
            <Button
              variant="outline"
              type="button"
              disabled={pending}
              onClick={() => setTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant={target?.action === "remove" ? "destructive" : "default"}
              type="submit"
              disabled={pending}
            >
              {pending
                ? "Saving…"
                : target?.action === "remove"
                  ? "Confirm removal"
                  : "Set new password"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
