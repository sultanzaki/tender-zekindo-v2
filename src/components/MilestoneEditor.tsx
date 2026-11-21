"use client";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

import { useState, useTransition } from "react";
import { ensureMilestoneTypeByName } from "@/lib/milestone-actions";
import { findOutOfOrderMilestones } from "@/lib/tender-logic";
import type { MilestoneType, Track } from "@/lib/types";
import styles from "./NewTenderForm.module.css";
export function MilestoneEditor({
  track,
  catalog,
  order,
  dates,
  onOrder,
  onDates,
  onCreated,
}: {
  track: Track;
  catalog: MilestoneType[];
  order: string[];
  dates: Record<string, string>;
  onOrder: (order: string[]) => void;
  onDates: (dates: Record<string, string>) => void;
  onCreated?: (type: MilestoneType) => void;
}) {
  const [extra, setExtra] = useState<MilestoneType[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const all = [
    ...catalog,
    ...extra.filter((m) => !catalog.some((c) => c.key === m.key)),
  ];
  const selected = order
    .map((key) => all.find((m) => m.key === key))
    .filter((m): m is MilestoneType => !!m);
  const hidden = all.filter((m) => !order.includes(m.key));
  const issues = findOutOfOrderMilestones(dates, selected);
  function move(i: number, offset: number) {
    const next = [...order];
    [next[i], next[i + offset]] = [next[i + offset], next[i]];
    onOrder(next);
  }
  function add() {
    if (!name.trim() || pending) return;
    setError("");
    start(async () => {
      try {
        const result = await ensureMilestoneTypeByName(name.trim(), track);
        if (result.error || !result.key) {
          setError(result.error || "Milestone could not be created.");
          return;
        }
        const key = result.key;
        if (!all.some((m) => m.key === key)) {
          const created = {
            id: key,
            key,
            label: name.trim(),
            track,
            sortOrder: 0,
            showInTable: false,
          };
          setExtra((prev) => [...prev, created]);
          onCreated?.(created);
        }
        if (!order.includes(key)) onOrder([...order, key]);
        setName("");
      } catch {
        setError("Could not create milestone. Please try again.");
      }
    });
  }
  return (
    <div className={styles.fieldColumn}>
      <p className={styles.hint}>
        Set the steps this tender needs. Removing a step hides it from this
        tender; existing dates are retained. Past dates are scheduled history,
        not proof of completion.
      </p>
      {issues.length > 0 && (
        <div className={styles.orderWarning} role="status">
          {issues.map((issue, i) => (
            <div key={i}>
              {issue.laterLabel} is dated before {issue.earlierLabel}. Check
              this sequence.
            </div>
          ))}
        </div>
      )}
      <div className={styles.milestoneList}>
        {selected.map((m, i) => (
          <div key={m.key} className={styles.milestoneRow}>
            <span className={styles.stepNumber}>{i + 1}</span>
            <Label className={styles.label}>
              {m.label}
              <Input
                type="date"
                className={styles.input}
                value={dates[m.key] || ""}
                onChange={(e) => onDates({ ...dates, [m.key]: e.target.value })}
              />
            </Label>
            <div className={styles.milestoneActions}>
              <Button
                variant="ghost"
                className="icon-button"
                type="button"
                aria-label={`Move ${m.label} up`}
                disabled={i === 0 || pending}
                onClick={() => move(i, -1)}
              >
                ↑
              </Button>
              <Button
                variant="ghost"
                className="icon-button"
                type="button"
                aria-label={`Move ${m.label} down`}
                disabled={i === selected.length - 1 || pending}
                onClick={() => move(i, 1)}
              >
                ↓
              </Button>
              <Button
                variant="outline"
                type="button"
                disabled={pending}
                onClick={() => onOrder(order.filter((k) => k !== m.key))}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>
      {!selected.length && (
        <p className="muted">
          No milestones selected. Add a step below, or save this tender without
          a schedule.
        </p>
      )}
      {hidden.length > 0 && (
        <Label className={styles.label}>
          Add an existing step
          <NativeSelect
            className={styles.input}
            value=""
            onChange={(e) => {
              if (e.target.value) onOrder([...order, e.target.value]);
            }}
          >
            <NativeSelectOption value="">
              Choose a milestone…
            </NativeSelectOption>
            {hidden.map((m) => (
              <NativeSelectOption key={m.key} value={m.key}>
                {m.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Label>
      )}
      <Collapsible className={styles.customMilestone}>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="outline">
            Create a custom milestone
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <p className="muted">
            This adds a named step to the {track} catalog, and selects it for
            this tender.
          </p>
          <div className={styles.fieldRowInline}>
            <Input
              aria-label="Custom milestone name"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="e.g. Site visit"
            />
            <Button
              variant="outline"
              type="button"
              onClick={add}
              disabled={pending || !name.trim()}
            >
              {pending ? "Creating…" : "Create milestone"}
            </Button>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
