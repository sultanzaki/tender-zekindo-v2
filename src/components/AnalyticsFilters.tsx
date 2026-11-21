"use client";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";

import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import { TRACKS, TRACK_LABELS, type Track } from "@/lib/types";
import styles from "../app/analytics/Analytics.module.css";
export function AnalyticsFilters({
  report,
  areas,
  periods,
  customers = [],
  area,
  period,
  customer = "all",
  track,
}: {
  report?: string;
  areas: string[];
  periods: string[];
  customers?: string[];
  area: string;
  period: string;
  customer?: string;
  track: Track | "all";
}) {
  const router = useRouter();
  const path = usePathname();
  const [pending, start] = useTransition();
  function apply(
    patch: Partial<{
      track: string;
      area: string;
      period: string;
      customer: string;
    }>,
  ) {
    const selected = { track, area, period, customer, ...patch };
    const query = new URLSearchParams();
    if (report) query.set("report", report);
    for (const [key, value] of Object.entries(selected))
      if (value !== "all") query.set(key, value);
    start(() => router.push(query.size ? `${path}?${query}` : path));
  }
  return (
    <div className={styles.filterBar} aria-busy={pending}>
      <div className={styles.filterField}>
        <Label htmlFor="analytics-track">Track</Label>
        <NativeSelect
          id="analytics-track"
          value={track}
          disabled={pending}
          onChange={(e) => apply({ track: e.target.value })}
        >
          <NativeSelectOption value="all">Both tracks</NativeSelectOption>
          {TRACKS.map((t) => (
            <NativeSelectOption key={t} value={t}>
              {TRACK_LABELS[t]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {(
        [
          { key: "area", label: "Area", value: area, options: areas },
          { key: "period", label: "Period", value: period, options: periods },
          {
            key: "customer",
            label: "Customer",
            value: customer,
            options: customers,
          },
        ] as const
      ).map((field) => (
        <div className={styles.filterField} key={field.key}>
          <Label htmlFor={`analytics-${field.key}`}>{field.label}</Label>
          <NativeSelect
            id={`analytics-${field.key}`}
            value={field.value}
            disabled={pending}
            onChange={(e) => apply({ [field.key]: e.target.value })}
          >
            <NativeSelectOption value="all">
              All {field.label.toLowerCase()}s
            </NativeSelectOption>
            {field.options.map((value) => (
              <NativeSelectOption key={value}>{value}</NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      ))}
      <Button
        variant="outline"
        disabled={
          pending ||
          (track === "all" &&
            area === "all" &&
            period === "all" &&
            customer === "all")
        }
        onClick={() =>
          apply({ track: "all", area: "all", period: "all", customer: "all" })
        }
      >
        {pending ? "Applying…" : "Reset filters"}
      </Button>
    </div>
  );
}
