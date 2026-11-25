"use client";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { getFilterOptions } from "@/lib/tender-logic";
import { readTenderFilters } from "@/lib/table-state";
import {
  trackFromParam,
  type MilestoneType,
  type RegisterTender,
} from "@/lib/types";
import { TenderTableClient } from "./TenderTableClient";

export function RegisterWorkspace({
  rows,
  catalog,
  anchor,
  isAdmin,
  canViewMoney,
}: {
  rows: RegisterTender[];
  catalog: MilestoneType[];
  anchor: string;
  isAdmin: boolean;
  canViewMoney: boolean;
}) {
  const params = useSearchParams();
  const track =
    params.get("track") === "all" ? "all" : trackFromParam(params.get("track"));
  const tenders = useMemo(
    () => (track === "all" ? rows : rows.filter((t) => t.track === track)),
    [rows, track],
  );
  const options = useMemo(() => getFilterOptions(tenders), [tenders]);
  const milestones = useMemo(
    () =>
      track === "all" ? catalog : catalog.filter((m) => m.track === track),
    [catalog, track],
  );
  return (
    <TenderTableClient
      key={track}
      track={track}
      tenders={tenders}
      options={options}
      milestoneTypes={milestones}
      anchor={anchor}
      isAdmin={isAdmin}
      canViewMoney={canViewMoney}
      initialFilters={readTenderFilters(params)}
    />
  );
}
