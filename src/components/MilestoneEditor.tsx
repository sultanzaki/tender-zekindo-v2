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

import { useState } from "react";
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
  onCreated: (type: MilestoneType) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const selected = order
    .map((key) => catalog.find((m) => m.key === key))
    .filter((m): m is MilestoneType => !!m);
  const hidden = catalog.filter((m) => !order.includes(m.key));
  const issues = findOutOfOrderMilestones(dates, selected);
  function move(i: number, offset: number) {
    const next = [...order];
    [next[i], next[i + offset]] = [next[i + offset], next[i]];
    onOrder(next);
  }
  function add() {
    const label = name.trim();
    if (!label) return;
    if (label.length > 100) {
      setError("Use at most 100 characters.");
      return;
    }
    const existing = catalog.find(
      (m) => m.label.toLowerCase() === label.toLowerCase(),
    );
    const key =
      existing?.key ?? "local_" + crypto.randomUUID().replaceAll("-", "");
    if (!existing) {
      const stage = {
        id: key,
        key,
        label,
        track,
        sortOrder: order.length,
        showInTable: false,
      };
      onCreated(stage);
    }
    if (!order.includes(key)) onOrder([...order, key]);
    setError("");
    setName("");
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
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                ↑
              </Button>
              <Button
                variant="ghost"
                className="icon-button"
                type="button"
                aria-label={`Move ${m.label} down`}
                disabled={i === selected.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </Button>
              <Button
                variant="outline"
                type="button"
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
          <p className="muted">This step belongs to this tender only.</p>
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
              disabled={!name.trim()}
            >
              Create milestone
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
