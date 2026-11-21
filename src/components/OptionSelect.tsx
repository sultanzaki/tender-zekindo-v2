"use client";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

import { useState, useTransition } from "react";
import { addSelectOption } from "@/lib/actions";
import type { ExtendableField } from "@/lib/types";

const ADD_NEW = "__add_new__";

/**
 * Dropdown for any admin-extendable field (Area, Customer, Entity).
 *
 * The "+ Add new …" entry writes straight to the `select_options` table via
 * addSelectOption and immediately makes the value the current selection, so a
 * user never has to leave the form to introduce a value that doesn't exist
 * yet. Which fields are allowed to do this is decided server-side by
 * EXTENDABLE_FIELDS, not by the props here.
 */
export function OptionSelect({
  field,
  label,
  value,
  options,
  onChange,
  className,
  required,
}: {
  field: ExtendableField;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
}) {
  const [localOptions, setLocalOptions] = useState(options);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // A value can arrive from the server after mount (e.g. router.refresh), and
  // a value the user typed in a previous session may not be in the list yet.
  // Render both so the select never shows a blank for a populated field.
  const known =
    value && !localOptions.includes(value)
      ? [value, ...localOptions]
      : localOptions;

  function handleSelectChange(next: string) {
    if (next === ADD_NEW) {
      setAdding(true);
      return;
    }
    onChange(next);
  }

  function handleAdd() {
    if (isPending || !draft.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await addSelectOption(field, draft);
      if (result.error) {
        setError(result.error);
        return;
      }
      const newValue = result.value!;
      setLocalOptions((prev) =>
        prev.includes(newValue) ? prev : [...prev, newValue].sort(),
      );
      onChange(newValue);
      setAdding(false);
      setDraft("");
    });
  }

  if (adding) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <Input
          className={className}
          style={{ flex: 1 }}
          aria-label={`New ${label.toLowerCase()}`}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`New ${label.toLowerCase()}`}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button
          variant="default"
          type="button"
          onClick={handleAdd}
          disabled={isPending || !draft.trim()}
        >
          {isPending ? "Adding…" : "Add"}
        </Button>
        <Button
          variant="outline"
          type="button"
          disabled={isPending}
          onClick={() => {
            setAdding(false);
            setDraft("");
            setError(null);
          }}
        >
          Cancel
        </Button>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  return (
    <NativeSelect
      className={className}
      value={value}
      required={required}
      aria-label={label}
      onChange={(e) => handleSelectChange(e.target.value)}
    >
      <NativeSelectOption value="">
        Select {label.toLowerCase()}
      </NativeSelectOption>
      {known.map((option) => (
        <NativeSelectOption key={option} value={option}>
          {option}
        </NativeSelectOption>
      ))}
      <NativeSelectOption value={ADD_NEW}>
        + Add new {label.toLowerCase()}…
      </NativeSelectOption>
    </NativeSelect>
  );
}
