"use client";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { useActionState, useState } from "react";
import Image from "next/image";

import { login } from "@/lib/auth/actions";
import styles from "./AuthForm.module.css";
export function LoginForm({
  next,
  notice,
}: {
  next: string;
  notice?: string;
}) {
  const [state, action, pending] = useActionState(login, undefined);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <header className={styles.brand}>
          <Image
            src="/logo.png"
            alt="Zekindo"
            width={112}
            height={38}
            priority
          />
          <span>Tender workspace</span>
        </header>
        <section className={styles.formPanel}>
          <h1 className={styles.title}>Workspace sign in</h1>
          <p className={styles.subtitle}>
            Enter your Zekindo workspace credentials.
          </p>
          <form action={action} className={styles.fieldColumn}>
            <input type="hidden" name="next" value={next} />
            <Label className={styles.field}>
              Email address
              <Input
                className="control"
                type="email"
                name="email"
                autoComplete="username"
                autoCapitalize="none"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={pending}
                placeholder="you@zekindo.co.id"
              />
            </Label>
            <div className={styles.field}>
              <Label htmlFor="login-password">Password</Label>
              <div className={styles.passwordField}>
                <Input
                  className="control"
                  type={show ? "text" : "password"}
                  name="password"
                  id="login-password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={pending}
                />
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </Button>
              </div>
            </div>
            {notice && !state?.error && (
              <Alert>
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            )}
            {state?.error && (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}
            <Button variant="default" type="submit" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}{" "}
              <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </form>
          <p className={styles.help}>
            Need an account or a password reset? Contact your workspace
            administrator.
          </p>
        </section>
        <footer className={styles.footer}>PT Zeus Kimiatama Indonesia</footer>
      </div>
      <div aria-hidden="true" className={styles.offshore} />
    </main>
  );
}
