import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { supabaseServer } from "./supabase-server";
import type { TenderRow } from "./database.types";
import type { SelectOptionsMap, Tender, Track } from "./types";
import { distinctSorted } from "./tender-logic";
import { rowTrack } from "./milestones";
import { TENDERS_TAG } from "./cache-tags";
import { requireUser, requireAdmin } from "./auth/dal";

// PostgREST (Supabase's REST layer) serializes `numeric` columns as JSON
// strings, not numbers, to avoid precision loss — so despite the DB column
// type, these can arrive as "30644000000" rather than 30644000000. Coerce
// once here so the rest of the app can rely on Tender's numeric fields
// actually being numbers (sorting, sums for analytics, etc.).
function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const tenderColumns = "*, creator:profiles!tenders_created_by_fkey(name), editor:profiles!tenders_updated_by_fkey(name)";
type NamedTenderRow = TenderRow & {
  creator: { name: string } | null;
  editor: { name: string } | null;
};

function mapRow(row: NamedTenderRow): Tender {
  return {
    id: row.id,
    rowNo: row.row_no,
    track: rowTrack(row.track),
    period: row.period,
    area: row.area,
    tenderNo: row.tender_no,
    customer: row.customer,
    product: row.product,
    entitas: row.entitas,
    qty: toNumber(row.qty),
    oe: toNumber(row.oe),
    oeCatatan: row.oe_catatan,
    idrPerL: toNumber(row.idr_per_l),
    milestones: row.milestones,
    milestoneOrder: row.milestone_order,
    result: row.result,
    carryOver: row.carry_over,
    remarks: row.remarks,
    remark: row.remark,
    pnl: row.pnl,
    catatanInternal: row.catatan_internal,
    nilaiPenawaran: toNumber(row.nilai_penawaran),
    archivedAt: row.archived_at,
    createdBy: row.created_by,
    createdByName: row.creator?.name ?? null,
    updatedBy: row.updated_by,
    updatedByName: row.editor?.name ?? null,
    updatedAt: row.updated_at,
  };
}

const getTendersCached = unstable_cache(
  async (includeArchived: boolean, track: Track | "all"): Promise<Tender[]> => {
    const rows: Tender[] = [];
    const batch = 1000;
    for (let offset = 0; ; offset += batch) {
      let query = supabaseServer()
        .from("tenders")
        .select(tenderColumns)
        .order("row_no", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + batch - 1);
      if (!includeArchived) query = query.is("archived_at", null);
      if (track !== "all") query = query.eq("track", track);
      const { data, error } = await query;
      if (error) throw new Error(`Failed to load tenders: ${error.message}`);
      rows.push(...(data ?? []).map(mapRow));
      if (!data || data.length < batch) break;
    }
    return rows;
  },
  ["tenders:list", process.env.SUPABASE_URL || "unconfigured"],
  { tags: [TENDERS_TAG], revalidate: 30 },
);

// `cache()` on top so several components in one render share a single lookup.
export const getAllTenders = cache(
  async (options?: {
    includeArchived?: boolean;
    track?: Track | "all";
  }): Promise<Tender[]> => {
    // Check on every request, before even looking at the shared cache.
    const ctx = options?.includeArchived
      ? await requireAdmin()
      : await requireUser();
    const tenders = await getTendersCached(
      Boolean(options?.includeArchived),
      options?.track ?? "all",
    );
    return ctx.profile.role === "admin"
      ? tenders
      : tenders.map((t) => ({ ...t, catatanInternal: null }));
  },
);

export async function getArchivedTenders(): Promise<Tender[]> {
  await requireAdmin();
  const { data, error } = await supabaseServer()
    .from("tenders")
    .select(tenderColumns)
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });
  if (error)
    throw new Error(`Failed to load archived tenders: ${error.message}`);
  return (data ?? []).map(mapRow);
}

export async function getTenderById(id: string): Promise<Tender | null> {
  const ctx = await requireUser();
  const { data, error } = await supabaseServer()
    .from("tenders")
    .select(tenderColumns)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load tender: ${error.message}`);
  if (!data) return null;
  if (data.archived_at && ctx.profile.role !== "admin") return null;
  const tender = mapRow(data);
  return ctx.profile.role === "admin"
    ? tender
    : { ...tender, catatanInternal: null };
}

export { getFilterOptions } from "./tender-logic";

type FormReference = Pick<
  TenderRow,
  "id" | "tender_no" | "area" | "customer" | "entitas"
>;
const getFormReferences = unstable_cache(
  async (track: Track | "all") => {
    const rows: FormReference[] = [];
    const limit = 1000;
    for (let start = 0; ; start += limit) {
      let query = supabaseServer()
        .from("tenders")
        .select("id,tender_no,area,customer,entitas")
        .order("id")
        .range(start, start + limit - 1);
      if (track !== "all") query = query.eq("track", track);
      const { data, error } = await query;
      if (error)
        throw new Error(`Could not load tender choices: ${error.message}`);
      rows.push(...(data ?? []));
      if (!data || data.length < limit) return rows;
    }
  },
  ["tenders:form-references", process.env.SUPABASE_URL || "unconfigured"],
  { tags: [TENDERS_TAG], revalidate: 30 },
);

export async function getTenderFormChoices(track: Track | "all") {
  await requireAdmin();
  const [rows, options] = await Promise.all([
    getFormReferences(track),
    loadSelectOptions(),
  ]);
  const selectOptions = mergeSelectOptions(rows, options);
  const existingTenders = rows
    .filter((row) => row.tender_no)
    .map((row) => ({ id: row.id, tenderNo: row.tender_no }));
  return { selectOptions, existingTenders };
}

/** Dropdown options for every extendable field (Area, Customer, Entity):
 * existing tender values plus anything an admin added via
 * addSelectOption(), even if no tender uses it yet. */
async function loadSelectOptions() {
  const { data, error } = await supabaseServer()
    .from("select_options")
    .select("field, value");
  if (error) throw new Error(`Failed to load select options: ${error.message}`);

  return data ?? [];
}

function mergeSelectOptions(
  tenders: Pick<Tender, "area" | "customer" | "entitas">[],
  options: { field: string; value: string }[],
): SelectOptionsMap {
  const fromOptions: Record<string, string[]> = {};
  for (const row of options) {
    (fromOptions[row.field] ??= []).push(row.value);
  }

  return {
    area: distinctSorted([
      ...tenders.map((t) => t.area),
      ...(fromOptions.area ?? []),
    ]),
    customer: distinctSorted([
      ...tenders.map((t) => t.customer),
      ...(fromOptions.customer ?? []),
    ]),
    entitas: distinctSorted([
      ...tenders.map((t) => t.entitas),
      ...(fromOptions.entitas ?? []),
    ]),
  };
}

export async function getSelectOptions(
  tenders: Pick<Tender, "area" | "customer" | "entitas">[],
): Promise<SelectOptionsMap> {
  await requireUser();
  return mergeSelectOptions(tenders, await loadSelectOptions());
}
