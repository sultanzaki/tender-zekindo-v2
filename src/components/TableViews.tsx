"use client";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useState } from "react";
import type { TenderFilters } from "@/lib/types";
import { readTenderFilters } from "@/lib/table-state";
import { useStoredJSON } from "./useStoredJSON";
import { Modal } from "./Modal";
const EMPTY: { name: string; filters: TenderFilters }[] = [];
export function TableViews({
  track,
  filters,
  onApply,
}: {
  track: string;
  filters: TenderFilters;
  onApply: (filters: TenderFilters) => void;
}) {
  const [stored, save] = useStoredJSON(`zekindo-views:${track}`, EMPTY);
  const views = Array.isArray(stored)
    ? stored
        .filter(
          (v) =>
            v &&
            typeof v.name === "string" &&
            v.filters &&
            typeof v.filters === "object",
        )
        .slice(0, 10)
    : EMPTY;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="saved-views">
      <Label>
        Saved views{" "}
        <NativeSelect
          aria-label="Saved views"
          className="control"
          value=""
          onChange={(e) => {
            if (e.target.value === "") return;
            const view = views[Number(e.target.value)];
            if (view)
              onApply(
                readTenderFilters(
                  new URLSearchParams(
                    view.filters as unknown as Record<string, string>,
                  ),
                ),
              );
          }}
        >
          <NativeSelectOption value="">Choose a view…</NativeSelectOption>
          {views.map((v, i) => (
            <NativeSelectOption key={i} value={i}>
              {v.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Label>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Save view
      </Button>
      <Modal
        open={open}
        title="Save current filters"
        onClose={() => setOpen(false)}
      >
        <p className="muted">
          Saved on this browser for the {track} track. Your shareable URL works
          on any device.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const next = [
              ...views.filter((v) => v.name !== name.trim()),
              { name: name.trim(), filters },
            ].slice(-10);
            if (save(next)) {
              setOpen(false);
              setName("");
            } else
              setError(
                "Browser storage is unavailable. You can bookmark the URL instead.",
              );
          }}
        >
          <Label className="field">
            View name
            <Input
              className="control"
              required
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Active opportunities in Jawa"
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
              type="button"
              onClick={() => {
                save(EMPTY);
                setOpen(false);
              }}
            >
              Clear saved views
            </Button>
            <Button variant="default" type="submit" disabled={!name.trim()}>
              Save view
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
