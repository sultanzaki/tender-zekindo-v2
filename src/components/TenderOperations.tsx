import type { ReactNode } from "react";
import { formatDateID, REMINDER_DAYS } from "@/lib/tender-logic";
import styles from "./TenderOperations.module.css";

export function OperationsHeading({
  title,
  context,
  actions,
}: {
  title: string;
  context?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.heading}>
      <div>
        <h1>{title}</h1>
        {context && <div className={styles.context}>{context}</div>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}

export function MilestoneDue({
  label,
  date,
  days,
  emptyLabel = "No upcoming milestone",
}: {
  label?: string;
  date?: string;
  days?: number;
  emptyLabel?: string;
}) {
  if (!date) return <span className={styles.secondary}>{emptyLabel}</span>;

  return (
    <span className={styles.due} data-urgent={days !== undefined && days <= REMINDER_DAYS}>
      <strong>{label}</strong>
      <span>
        <time dateTime={date}>{formatDateID(date)}</time>
        {days === 0 ? <b>Today</b> : days === 1 ? <b>Tomorrow</b> : null}
      </span>
    </span>
  );
}
