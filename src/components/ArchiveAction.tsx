"use client";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { restoreTender, deleteTenderPermanently } from "@/lib/actions";
import { Modal } from "./Modal";
export function ArchiveAction({
  tenderId,
  action,
}: {
  tenderId: string;
  action: "restore" | "delete";
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const label = action === "restore" ? "Restore" : "Delete permanently";
  function run() {
    setError("");
    start(async () => {
      const result = await (action === "restore"
        ? restoreTender(tenderId)
        : deleteTenderPermanently(tenderId));
      if (result?.error) setError(result.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }
  return (
    <>
      <Button
        variant={action === "restore" ? "outline" : "destructive"}
        disabled={pending}
        onClick={() => {
          if (action === "restore") run();
          else setOpen(true);
        }}
      >
        {pending ? "Working…" : label}
      </Button>
      <Modal
        open={open}
        title="Permanently delete tender?"
        onClose={() => {
          if (!pending) setOpen(false);
        }}
      >
        <p className="muted">
          This removes the tender and its documents. This action cannot be
          undone.
        </p>
        <Label className="field">
          Type DELETE to confirm
          <Input
            className="control"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
          />
        </Label>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="dialog-actions">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={pending || typed !== "DELETE"}
            onClick={run}
          >
            Delete permanently
          </Button>
        </div>
      </Modal>
      {error && !open && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </>
  );
}
