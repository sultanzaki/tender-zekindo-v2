/** What is kept, for how long, and what happens afterwards. Mirrors
 * supabase/migrations/0019 (apply_retention) — change both together. */
export const ARCHIVE_REVIEW_YEARS = 5;

export const RETENTION_POLICY = [
  {
    data: "Access log",
    detail: "Sign-ins, exports, downloads, administrator actions",
    period: "12 months",
    after: "Deleted automatically. Rows cannot be edited or removed earlier.",
  },
  {
    data: "Sessions",
    detail: "Expired sign-in sessions",
    period: "7 days after expiry",
    after: "Deleted automatically.",
  },
  {
    data: "Error log",
    detail: "Errors reported by browsers",
    period: "90 days",
    after: "Deleted automatically.",
  },
  {
    data: "Email queue and daily digests",
    detail: "Meeting reminder mail, reminder digests",
    period: "30 days",
    after: "Deleted automatically.",
  },
  {
    data: "Tenders, documents and their history",
    detail: "Business records, including archived tenders",
    period: `Archived tenders: review after ${ARCHIVE_REVIEW_YEARS} years`,
    after: "Never deleted automatically. An administrator decides; deletions are logged.",
  },
] as const;
