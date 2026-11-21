import type { ReactNode } from "react";
import { formatDateID, REMINDER_DAYS } from "@/lib/tender-logic";
import styles from "./TenderOperations.module.css";

const monthName = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });

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
      <time className={styles.dateStamp} dateTime={date} aria-label={formatDateID(date) ?? date}>
        <span>{monthName.format(new Date(date))}</span>
        <strong>{date.slice(8, 10)}</strong>
      </time>
      <span className={styles.dateText}><strong>{label}</strong>
      <span>
        {formatDateID(date)}
        {days === 0 ? <b>Today</b> : days === 1 ? <b>Tomorrow</b> : null}
      </span></span>
    </span>
  );
}
