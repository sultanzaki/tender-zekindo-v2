import type { TenderEventAction, TenderEventChange } from "./types";

const ACTIONS: Record<TenderEventAction, string> = {
  create: "created the tender",
  update: "updated",
  archive: "archived the tender",
  restore: "restored the tender",
  delete: "deleted the tender",
};

const FIELDS: Record<string, string> = {
  result: "status",
  remarks: "remarks",
  remark: "additional remark",
  milestones: "milestone dates",
  milestone_order: "stage order",
  milestone_labels: "stage names",
  milestone_notes: "milestone notes",
  oe: "OE value",
  oe_catatan: "OE note",
  nilai_penawaran: "bid value",
  idr_per_l: "IDR/L",
  catatan_internal: "internal notes",
  tender_no: "tender number",
  product: "package title",
  customer: "customer",
  area: "area",
  entitas: "entity",
  qty: "quantity",
  period: "period",
  pnl: "P&L flag",
  carry_over: "carry over",
  track: "track",
};
const HIDDEN = new Set(["updated_by", "updated_at", "created_by", "archived_at"]);

/** "Rina Pratama updated" + "status (Running → WIN), remarks" for the history. */
export function describeTenderEvent(event: {
  action: TenderEventAction;
  changes: Record<string, TenderEventChange> | null;
}): { verb: string; detail: string | null } {
  const verb = ACTIONS[event.action] ?? event.action;
  if (!event.changes) return { verb, detail: null };
  const parts = Object.entries(event.changes)
    .filter(([key]) => !HIDDEN.has(key))
    .map(([key, change]) => {
      const label = FIELDS[key] ?? key.replace(/_/g, " ");
      if (key === "result" && (change.from ?? null) !== (change.to ?? null))
        return `${label} (${(change.from as string) || "Running"} → ${(change.to as string) || "Running"})`;
      return label;
    });
  if (!parts.length) return { verb, detail: null };
  const text = parts.join(", ");
  return { verb, detail: text.charAt(0).toUpperCase() + text.slice(1) };
}
