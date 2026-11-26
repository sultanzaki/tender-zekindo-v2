"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  beginTwoFactorSetup,
  confirmTwoFactorSetup,
  disableTwoFactor,
} from "@/lib/auth/two-factor-actions";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "long" });

export function SecurityClient({
  enabledAt,
  recoveryLeft,
}: {
  enabledAt: string | null;
  recoveryLeft: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [disabling, setDisabling] = useState(false);

  const begin = () =>
    start(async () => {
      setError("");
      const result = await beginTwoFactorSetup();
      if (result.error || !result.secret || !result.qr) setError(result.error ?? "Could not start setup.");
      else setSetup({ secret: result.secret, qr: result.qr });
    });
  const confirm = () =>
    start(async () => {
      setError("");
      const result = await confirmTwoFactorSetup(code);
      if (result.error || !result.recoveryCodes) return setError(result.error ?? "Could not turn on two-factor.");
      setSetup(null);
      setCode("");
      setCodes(result.recoveryCodes);
      router.refresh();
    });
  const disable = () =>
    start(async () => {
      setError("");
      const result = await disableTwoFactor(password, code);
      if (result.error) return setError(result.error);
      setDisabling(false);
      setPassword("");
      setCode("");
      router.refresh();
    });

  return (
    <div className="grid max-w-xl gap-4 rounded-xl border bg-card p-5">
      <div>
        <strong className="block text-base">
          Two-factor authentication {enabledAt ? "is on" : "is off"}
        </strong>
        <p className="mt-1 text-sm text-muted-foreground">
          {enabledAt
            ? `Turned on ${dateFormat.format(new Date(enabledAt))}. Signing in asks for a code from your authenticator app. ${recoveryLeft} recovery code${recoveryLeft === 1 ? "" : "s"} left.`
            : "Signing in will also ask for a 6-digit code from an authenticator app (Google Authenticator, 1Password, Authy…)."}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {codes && (
        <div className="grid gap-2 rounded-lg border bg-muted p-4">
          <strong>Save your recovery codes</strong>
          <p className="text-sm text-muted-foreground">
            Each works once if you lose your phone. They are shown only now.
          </p>
          <ul className="grid grid-cols-2 gap-1 font-mono text-sm" aria-label="Recovery codes">
            {codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigator.clipboard?.writeText(codes.join("\n"))}
            >
              Copy
            </Button>
            <Button type="button" onClick={() => setCodes(null)}>
              I saved them
            </Button>
          </div>
        </div>
      )}

      {!enabledAt && !setup && !codes && (
        <div>
          <Button type="button" onClick={begin} disabled={pending}>
            Set up two-factor
          </Button>
        </div>
      )}

      {setup && (
        <div className="grid gap-3">
          <p className="text-sm">
            1. Scan this QR code with your authenticator app, or type the key by hand.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qr} alt="QR code for your authenticator app" width={220} height={220} className="rounded-lg border bg-white" />
          <code className="break-all rounded bg-muted px-2 py-1 text-sm">{setup.secret}</code>
          <p className="text-sm">2. Enter the 6-digit code it shows.</p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              confirm();
            }}
          >
            <Input
              className="control"
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label="6-digit code"
              placeholder="123 456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <Button type="submit" disabled={pending}>
              Turn on
            </Button>
          </form>
        </div>
      )}

      {enabledAt && !disabling && !codes && (
        <div>
          <Button type="button" variant="outline" onClick={() => { setDisabling(true); setError(""); }}>
            Turn off two-factor
          </Button>
        </div>
      )}

      {enabledAt && disabling && (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            disable();
          }}
        >
          <Label className="grid gap-1.5 text-sm">
            Password
            <Input className="control" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Label>
          <Label className="grid gap-1.5 text-sm">
            Current code or a recovery code
            <Input className="control" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required />
          </Label>
          <div className="flex gap-2">
            <Button type="submit" variant="destructive" disabled={pending}>
              Turn off
            </Button>
            <Button type="button" variant="outline" onClick={() => setDisabling(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
