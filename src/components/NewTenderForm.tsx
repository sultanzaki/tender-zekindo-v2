"use client";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { Button } from "@/components/ui/button";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTender } from "@/lib/actions";
import {
  findDuplicateTenderNo,
  formatDateID,
  formatRupiah,
} from "@/lib/tender-logic";
import { validateTender } from "@/lib/validation";
import type {
  MilestoneType,
  SelectOptionsMap,
  TenderFormValues,
  Track,
} from "@/lib/types";
import { PageHeading } from "./PageHeading";
import { TenderFields } from "./TenderFields";
import { MilestoneEditor } from "./MilestoneEditor";
import { Modal } from "./Modal";
import { useUnsavedChanges } from "./useUnsavedChanges";
import styles from "./NewTenderForm.module.css";
const STEPS = [
  "Tender details",
  "Value & entity",
  "Milestone schedule",
  "Review & create",
];
export function NewTenderForm({
  initialTrack,
  selectOptions,
  catalogs,
  existingTenders,
}: {
  initialTrack: Track;
  selectOptions: SelectOptionsMap;
  catalogs: Record<Track, MilestoneType[]>;
  existingTenders: { id: string; tenderNo: string | null }[];
}) {
  const [values, setValues] = useState<TenderFormValues>({
    track: initialTrack,
    area: "",
    tenderNo: "",
    customer: "",
    product: "",
    entitas: "",
    qty: "",
    oe: "",
    oeCatatan: "",
    nilaiPenawaran: "",
    milestones: {},
  });
  const [extra, setExtra] = useState<MilestoneType[]>([]);
  const [orders, setOrders] = useState({
    upstream: catalogs.upstream.map((m) => m.key),
    downstream: catalogs.downstream.map((m) => m.key),
  });
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [discard, setDiscard] = useState(false);
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [dates, setDates] = useState<Record<Track, Record<string, string>>>({
    upstream: {},
    downstream: {},
  });
  const selectedDates = dates[values.track];
  const currentValues = { ...values, milestones: selectedDates };
  const catalog = [
    ...catalogs[values.track],
    ...extra.filter((m) => m.track === values.track),
  ];
  const scheduleChanged = (["upstream", "downstream"] as const).some(
    (track) =>
      orders[track].join("|") !== catalogs[track].map((m) => m.key).join("|") ||
      Object.values(dates[track]).some(Boolean),
  );
  const dirty =
    scheduleChanged ||
    values.track !== initialTrack ||
    Object.entries(values).some(
      ([key, value]) =>
        key !== "track" && typeof value === "string" && value !== "",
    );
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (step !== previousStep.current) {
      previousStep.current = step;
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: "nearest" });
    }
  }, [step]);
  const leave = useUnsavedChanges(dirty && !pending);
  const back =
    values.track === "downstream" ? "/tenders?track=downstream" : "/tenders";
  function advance() {
    setError("");
    if (step === 0 && (!values.area.trim() || !values.customer.trim())) {
      form.current?.reportValidity();
      setError("Select an area and customer to continue.");
      return;
    }
    if (step === 1) {
      const issue = validateTender(currentValues);
      if (issue) {
        setError(issue);
        return;
      }
    }
    setStep(Math.min(3, step + 1));
  }
  function submit() {
    const issue = validateTender(currentValues);
    if (issue) {
      setError(issue);
      return;
    }
    setError("");
    start(async () => {
      const result = await createTender({
        ...currentValues,
        privateStages: Object.fromEntries(extra.filter(m => m.track === values.track).map(m => [m.key, m.label])),
        milestoneOrder: orders[values.track],
      });
      if (result?.error) setError(result.error);
    });
  }
  return (
    <div className={styles.createPage}>
      <PageHeading
        title="New tender"
        actions={
          <Button
            variant="outline"
            onClick={() => (dirty ? setDiscard(true) : router.push(back))}
          >
            Cancel
          </Button>
        }
      />
      <div
        className={styles.steps}
        aria-label={`Step ${step + 1} of 4: ${STEPS[step]}`}
      >
        {STEPS.map((label, i) => (
          <Button
            variant="ghost"
            key={label}
            type="button"
            className={`${styles.step} ${i === step ? styles.stepActive : ""}`}
            disabled={pending || i > step}
            onClick={() => {
              setError("");
              setStep(i);
            }}
            aria-current={i === step ? "step" : undefined}
          >
            <span className={styles.stepNumber}>{i + 1}</span>
            <span>{label}</span>
          </Button>
        ))}
      </div>
      <form
        ref={form}
        className={styles.card}
        onSubmit={(e) => {
          e.preventDefault();
          if (step === 3) submit();
          else advance();
        }}
      >
        <div className={styles.sectionHeading}>
          <h2 ref={heading} tabIndex={-1}>
            {STEPS[step]}
          </h2>
          <span>Step {step + 1} of 4</span>
        </div>
        <fieldset disabled={pending} className={styles.fieldset}>
          {step === 0 && (
            <TenderFields
              section="details"
              values={values}
              onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
              options={selectOptions}
              allowTrack
              duplicate={findDuplicateTenderNo(
                values.tenderNo,
                existingTenders,
              )}
            />
          )}
          {step === 1 && (
            <TenderFields
              section="value"
              values={values}
              onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
              options={selectOptions}
            />
          )}
          {step === 2 && (
            <MilestoneEditor
              key={values.track}
              track={values.track}
              catalog={catalog}
              onCreated={(created) => setExtra((prev) => [...prev, created])}
              order={orders[values.track]}
              dates={selectedDates}
              onOrder={(order) =>
                setOrders((o) => ({ ...o, [values.track]: order }))
              }
              onDates={(milestones) =>
                setDates((d) => ({ ...d, [values.track]: milestones }))
              }
            />
          )}
          {step === 3 && (
            <div className={styles.review}>
              <p className="muted">
                Check these details before creating the tender. Unknown amounts
                and milestone dates can stay blank.
              </p>
              <dl>
                {[
                  ["Track", values.track],
                  ["Area", values.area],
                  ["Customer", values.customer],
                  ["Tender number", values.tenderNo || "—"],
                  ["Package", values.product || "—"],
                  ["Entity", values.entitas || "—"],
                  ["Quantity", values.qty || "—"],
                  ["OE note", values.oeCatatan || "—"],
                  ["OE", values.oe ? formatRupiah(values.oe) : "—"],
                  [
                    "Bid value",
                    values.nilaiPenawaran
                      ? formatRupiah(values.nilaiPenawaran)
                      : "—",
                  ],
                  [
                    "Milestones",
                    `${orders[values.track].length} selected · ${orders[values.track].filter((k) => selectedDates[k]).length} dates set`,
                  ],
                ].map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              {orders[values.track].length > 0 && (
                <details className={styles.reviewSchedule}>
                  <summary>Review milestone dates</summary>
                  <dl>
                    {orders[values.track].map((key) => (
                      <div key={key}>
                        <dt>
                          {catalog.find((m) => m.key === key)?.label ?? key}
                        </dt>
                        <dd>
                          {selectedDates[key]
                            ? formatDateID(selectedDates[key])
                            : "Not scheduled"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}
            </div>
          )}
        </fieldset>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className={styles.footer}>
          <Button
            variant="outline"
            type="button"
            disabled={step === 0 || pending}
            onClick={() => {
              setError("");
              setStep(step - 1);
            }}
          >
            Back
          </Button>
          <Button variant="default" type="submit" disabled={pending}>
            {pending ? "Creating…" : step === 3 ? "Create tender" : "Next"}
          </Button>
        </div>
      </form>
      <Modal
        open={discard}
        title="Discard this new tender?"
        onClose={() => setDiscard(false)}
      >
        <p className="muted">Your unsaved entries will be lost.</p>
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setDiscard(false)}>
            Keep editing
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setDiscard(false);
              router.push(back);
            }}
          >
            Discard changes
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
