"use client";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { useActionState, useState } from "react";
import Image from "next/image";

import { login, verifyTwoFactorLogin } from "@/lib/auth/actions";
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
  if (state?.twoFactor)
    return <TwoFactorStep next={next} />;
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

/** Second sign-in step for accounts with two-factor on. */
function TwoFactorStep({ next }: { next: string }) {
  const [state, action, pending] = useActionState(verifyTwoFactorLogin, undefined);
  const restart = state?.restart;
  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <header className={styles.brand}>
          <Image src="/logo.png" alt="Zekindo" width={112} height={38} priority />
          <span>Tender workspace</span>
        </header>
        <section className={styles.formPanel}>
          <h1 className={styles.title}>Two-step verification</h1>
          <p className={styles.subtitle}>
            Enter the 6-digit code from your authenticator app, or one of your
            recovery codes.
          </p>
          {restart ? (
            <div className={styles.fieldColumn}>
              <Alert variant="destructive">
                <AlertDescription>{state?.error}</AlertDescription>
              </Alert>
              <Button asChild variant="default">
                <a href={`/login?${new URLSearchParams({ next })}`}>Back to sign in</a>
              </Button>
            </div>
          ) : (
            <form action={action} className={styles.fieldColumn}>
              <input type="hidden" name="next" value={next} />
              <Label className={styles.field}>
                Verification code
                <Input
                  className="control"
                  name="code"
                  inputMode="text"
                  autoComplete="one-time-code"
                  autoCapitalize="none"
                  autoFocus
                  required
                  disabled={pending}
                  placeholder="123 456"
                />
              </Label>
              {state?.error && (
                <Alert variant="destructive">
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              )}
              <Button variant="default" type="submit" disabled={pending}>
                {pending ? "Verifying…" : "Verify"}{" "}
                <ArrowRight size={16} aria-hidden="true" />
              </Button>
              <a className={styles.help} href={`/login?${new URLSearchParams({ next })}`}>
                Use a different account
              </a>
            </form>
          )}
        </section>
        <footer className={styles.footer}>PT Zeus Kimiatama Indonesia</footer>
      </div>
      <div aria-hidden="true" className={styles.offshore} />
    </main>
  );
}
