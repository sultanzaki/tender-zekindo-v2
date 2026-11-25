"use client";
import { useState, useTransition } from "react";
import { updateMilestoneNote } from "@/lib/actions";
import { MILESTONE_NOTE_MAX_LENGTH } from "@/lib/types";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import styles from "./TenderDetail.module.css";

/** The note under one milestone on the Schedule tab. Everyone can read it;
 * administrators can add, change or clear it in place. */
export function MilestoneNote({
  tenderId,
  milestoneKey,
  label,
  note,
  canEdit,
}: {
  tenderId: string;
  milestoneKey: string;
  label: string;
  note?: string;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  // Shown right after a save; the page's `key` remounts this with server data.
  const [current, setCurrent] = useState(note ?? "");
  const [draft, setDraft] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fieldId = `milestone-note-${milestoneKey}`;

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateMilestoneNote(tenderId, milestoneKey, draft);
      if (result?.error) setError(result.error);
      else {
        setCurrent(draft.trim());
        setEditing(false);
      }
    });
  }

  if (editing)
    return (
      <div className={styles.milestoneNoteEditor}>
        <label htmlFor={fieldId} className="sr-only">
          Notes for {label}
        </label>
        <Textarea
          id={fieldId}
          value={draft}
          autoFocus
          maxLength={MILESTONE_NOTE_MAX_LENGTH}
          placeholder="Write a note for this milestone…"
          disabled={pending}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDraft(current);
              setEditing(false);
            }
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
          }}
        />
        {error && (
          <p className="feedback feedback-error" role="alert">
            {error}
          </p>
        )}
        <div className={styles.milestoneNoteActions}>
          <Button type="button" size="sm" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save note"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setDraft(current);
              setError(null);
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );

  return (
    <div className={styles.milestoneNote}>
      {current && <p className={styles.milestoneNoteText}>{current}</p>}
      {canEdit && (
        <Button
          type="button"
          size="sm"
          variant="link"
          className={styles.milestoneNoteButton}
          aria-label={`${current ? "Edit" : "Add"} note for ${label}`}
          onClick={() => {
            setDraft(current);
            setEditing(true);
          }}
        >
          {current ? "Edit note" : "Add note"}
        </Button>
      )}
    </div>
  );
}
