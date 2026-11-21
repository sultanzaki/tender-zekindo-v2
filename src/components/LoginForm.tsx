"use client";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { useActionState, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { login } from "@/lib/auth/actions";
import styles from "./AuthForm.module.css";
export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  return (
    <main className={styles.page}>
      <div className={styles.brand}>
        <Link href="/">
          <Image
            src="/logo.png"
            alt="Zekindo"
            width={110}
            height={37}
            priority
          />
        </Link>
        <span>Tender workspace</span>
      </div>
      <Card className={styles.card}>
        <h1 className={styles.title}>Sign in to Zekindo</h1>
        <p className={styles.subtitle}>
          Use your workspace email and password.
        </p>
        <form action={action} className={styles.fieldColumn}>
          <input type="hidden" name="next" value={next} />
          <Label className="field">
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
          <div className="field">
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
                {show ? "Hide" : "Show"}
              </Button>
            </div>
          </div>
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <Button variant="default" type="submit" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className={styles.help}>
          Need an account or a password reset? Contact your workspace
          administrator.
        </p>
      </Card>
      <footer className={styles.footer}>PT Zeus Kimiatama Indonesia</footer>
    </main>
  );
}
