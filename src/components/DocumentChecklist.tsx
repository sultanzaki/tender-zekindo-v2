"use client";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useState, useTransition } from "react";
import {
  addDocumentType,
  removeTenderDocumentFile,
  toggleTenderDocument,
} from "@/lib/document-actions";
import type { TenderDocument } from "@/lib/types";
import styles from "./DocumentChecklist.module.css";

export function DocumentChecklist({
  tenderId,
  documents,
  isAdmin,
}: {
  tenderId: string;
  documents: TenderDocument[];
  isAdmin: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  function handleToggle(documentTypeId: string, checked: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await toggleTenderDocument(
        tenderId,
        documentTypeId,
        checked,
      );
      if (result?.error) setError(result.error);
    });
  }

  function handleRemoveFile(documentTypeId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeTenderDocumentFile(tenderId, documentTypeId);
      if (result?.error) setError(result.error);
    });
  }

  function handleAddType() {
    setError(null);
    startTransition(async () => {
      const result = await addDocumentType(newLabel, tenderId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setNewLabel("");
      setShowAdd(false);
    });
  }

  return (
    <div>
      {documents.map((doc) => (
        <div key={doc.documentTypeId} className={styles.row}>
          <Checkbox
            aria-label={doc.label}
            id={`document-ready-${doc.documentTypeId}`}
            className={styles.checkbox}
            checked={doc.checked}
            disabled={!isAdmin || isPending}
            onCheckedChange={(checked) =>
              handleToggle(doc.documentTypeId, checked === true)
            }
          />
          <Label
            htmlFor={`document-ready-${doc.documentTypeId}`}
            className={styles.label}
          >
            {doc.label}
          </Label>
          {doc.fileUrl && doc.fileName ? (
            <>
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.fileLink}
                title={doc.fileName}
              >
                {doc.fileName}
              </a>
              {isAdmin && (
                <Button
                  variant="ghost"
                  className={styles.removeLink}
                  onClick={() => handleRemoveFile(doc.documentTypeId)}
                  disabled={isPending}
                >
                  Remove
                </Button>
              )}
            </>
          ) : null}
        </div>
      ))}

      {isAdmin && (
        <>
          {showAdd ? (
            <div className={styles.addRow}>
              <Input
                className={styles.addInput}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="New document type name"
                aria-label="New document type name"
                autoFocus
              />
              <Button
                variant="ghost"
                className={styles.addButton}
                onClick={handleAddType}
                disabled={isPending || !newLabel.trim()}
              >
                Add
              </Button>
              <Button
                variant="ghost"
                className={styles.addButton}
                onClick={() => {
                  setShowAdd(false);
                  setNewLabel("");
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              className={styles.addToggle}
              onClick={() => setShowAdd(true)}
            >
              + Add document type
            </Button>
          )}
        </>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
