"use client";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { Button } from "@/components/ui/button";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveTender, updateTender } from "@/lib/actions";
import { findDuplicateTenderNo } from "@/lib/tender-logic";
import { validateTender } from "@/lib/validation";
import type {
  Tender,
  TenderEditFormValues,
  MilestoneType,
  SelectOptionsMap,
} from "@/lib/types";
import edit from "./EditTenderForm.module.css";
import { TenderFields } from "./TenderFields";
import { MilestoneEditor } from "./MilestoneEditor";
import { Modal } from "./Modal";
import { useUnsavedChanges } from "./useUnsavedChanges";
import styles from "./NewTenderForm.module.css";
const SECTIONS = ["Details", "Value & entity", "Milestones", "Outcome & notes"];
function fromTender(t: Tender): TenderEditFormValues {
  return {
    track: t.track,
    area: t.area,
    tenderNo: t.tenderNo || "",
    customer: t.customer,
    product: t.product || "",
    entitas: t.entitas || "",
    qty: t.qty === null ? "" : String(t.qty),
    oe: t.oe === null ? "" : String(t.oe),
    oeCatatan: t.oeCatatan || "",
    nilaiPenawaran: t.nilaiPenawaran === null ? "" : String(t.nilaiPenawaran),
    milestones: Object.fromEntries(
      Object.entries(t.milestones).map(([key, value]) => [key, value || ""]),
    ),
    result: t.result || "",
    carryOver: t.carryOver || "",
    remarks: t.remarks || "",
    remark: t.remark || "",
    pnl: t.pnl,
    catatanInternal: t.catatanInternal || "",
  };
}
export function EditTenderForm({
  tender,
  selectOptions,
  milestoneTypes,
  existingTenders,
  startOnMilestones = false,
  returnTo,
}: {
  tender: Tender;
  startOnMilestones?: boolean;
  returnTo?: string;
  selectOptions: SelectOptionsMap;
  milestoneTypes: MilestoneType[];
  existingTenders: { id: string; tenderNo: string | null }[];
}) {
  const initial = fromTender(tender);
  const initialOrder =
    tender.milestoneOrder ?? milestoneTypes.map((m) => m.key);
  const [extra, setExtra] = useState<MilestoneType[]>([]);
  const [values, setValues] = useState(initial);
  const [order, setOrder] = useState(initialOrder);
  const [section, setSection] = useState(startOnMilestones ? 2 : 0);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<"discard" | "archive" | null>(null);
  const router = useRouter();
  const detailHref = `/tenders/${tender.id}${returnTo ? "?" + new URLSearchParams({ returnTo }) : ""}`;
  const dirty =
    JSON.stringify(values) !== JSON.stringify(initial) ||
    JSON.stringify(order) !== JSON.stringify(initialOrder);
  const leave = useUnsavedChanges(dirty && !pending);
  function save() {
    const issue = validateTender(values);
    if (issue) {
      setError(issue);
      return;
    }
    setError("");
    start(async () => {
      const result = await updateTender(
        tender.id,
        {
          ...values,
          milestoneOrder: order,
        },
        returnTo,
      );
      if (result?.error) setError(result.error);
    });
  }
  return (
    <div className={edit.page}>
      <header className={edit.header}>
        <div>
          <h1>Edit tender</h1>
          <p>{tender.product || tender.customer}</p>
          <small>
            {tender.tenderNo || `Tender #${tender.rowNo}`} · {tender.track}
          </small>
        </div>
        <div className={edit.commands}>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              dirty ? setConfirm("discard") : router.push(detailHref)
            }
          >
            Cancel
          </Button>
          <Button form="edit-tender" type="submit" disabled={pending || !dirty}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </header>
      <div className={edit.workspace}>
        <nav className={edit.sections} aria-label="Edit sections">
          {SECTIONS.map((label, i) => (
            <Button
              variant="ghost"
              key={label}
              type="button"
              disabled={pending}
              aria-pressed={i === section}
              onClick={() => {
                setError("");
                setSection(i);
              }}
            >
              <span>{label}</span>
            </Button>
          ))}
        </nav>
        <form
          id="edit-tender"
          className={edit.form}
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className={styles.sectionHeading}>
            <h2>{SECTIONS[section]}</h2>
            <span>{dirty ? "Unsaved changes" : "Up to date"}</span>
          </div>
          <fieldset className={styles.fieldset} disabled={pending}>
            {section === 0 && (
              <TenderFields
                section="details"
                values={values}
                onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
                options={selectOptions}
                duplicate={findDuplicateTenderNo(
                  values.tenderNo,
                  existingTenders,
                  tender.id,
                )}
              />
            )}
            {section === 1 && (
              <TenderFields
                section="value"
                values={values}
                onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
                options={selectOptions}
              />
            )}
            {section === 2 && (
              <MilestoneEditor
                track={tender.track}
                catalog={[...milestoneTypes, ...extra]}
                onCreated={(created) => setExtra((prev) => [...prev, created])}
                order={order}
                dates={values.milestones}
                onOrder={setOrder}
                onDates={(milestones) =>
                  setValues((v) => ({ ...v, milestones }))
                }
              />
            )}
            {section === 3 && (
              <TenderFields
                section="outcome"
                values={values}
                onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
                options={selectOptions}
              />
            )}
          </fieldset>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>
      </div>
      <Button
        className={edit.archive}
        variant="ghost"
        disabled={pending}
        onClick={() => setConfirm("archive")}
      >
        Archive tender
      </Button>
      <Modal
        open={confirm !== null}
        title={
          confirm === "archive"
            ? "Archive this tender?"
            : "Discard unsaved changes?"
        }
        onClose={() => {
          if (!pending) setConfirm(null);
        }}
      >
        <p className="muted">
          {confirm === "archive"
            ? "The tender will leave active lists. You can restore it from Archive. Unsaved edits will not be applied."
            : "Your edits have not been saved."}
        </p>
        <div className="dialog-actions">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => setConfirm(null)}
          >
            Keep editing
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => {
              if (confirm === "discard") {
                setConfirm(null);
                router.push(detailHref);
              } else {
                start(async () => {
                  const result = await archiveTender(tender.id);
                  if (result?.error) {
                    setError(result.error);
                    setConfirm(null);
                  }
                });
              }
            }}
          >
            {pending
              ? "Working…"
              : confirm === "archive"
                ? "Confirm archive"
                : "Discard changes"}
          </Button>
        </div>
      </Modal>
      <Modal
        open={leave.href !== null}
        title="Leave without saving?"
        onClose={leave.cancel}
      >
        <p className="muted">
          Your changes have not been saved. Keep editing to avoid losing them.
        </p>
        <div className="dialog-actions">
          <Button variant="outline" onClick={leave.cancel}>
            Keep editing
          </Button>
          <Button variant="destructive" onClick={leave.confirm}>
            Discard and leave
          </Button>
        </div>
      </Modal>
    </div>
  );
}
