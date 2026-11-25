"use client";
import { plural } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

import {
  TableHead,
  Table,
  TableHeader,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

import {
  Fragment,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { MeetingLink } from "@/components/MeetingLink";
import { flushSync } from "react-dom";
import { OperationsHeading } from "./TenderOperations";
import { MoneyValue } from "./MoneyValue";
import { Icon } from "./Icon";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import {
  ListFilter,
  Columns3,
  CalendarClock,
  CalendarOff,
  BriefcaseBusiness,
  CalendarRange,
} from "lucide-react";
import { TableViews } from "./TableViews";
import { Modal } from "./Modal";
import { useStoredJSON } from "./useStoredJSON";
import { readTenderFilters, tenderQuery } from "@/lib/table-state";
import { TrackSwitch } from "./TrackSwitch";
import { useRouter } from "next/navigation";
import {
  bulkArchiveTenders,
  quickUpdateMilestone,
  quickUpdateResult,
} from "@/lib/actions";
import {
  DEFAULT_FILTERS,
  RESULT_ENUM,
  type FilterOptions,
  type MilestoneType,
  type RegisterTender,
  type TenderFilters,
  type Track,
  TRACK_LABELS,
} from "@/lib/types";
import { TrackBadge } from "./TrackBadge";
import {
  dateTone,
  deadlineBucket,
  filterTenders,
  formatDateID,
  nextMilestone,
  resolveTenderMilestones,
  sortTenders,
  type SortDirection,
  type SortKey,
} from "@/lib/tender-logic";
import { ResultBadge } from "./ResultBadge";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
import styles from "./TenderTable.module.css";

const DATE_TONE_CLASS = {
  empty: styles.dateEmpty,
  past: styles.datePast,
  urgent: styles.dateUrgent,
  soon: styles.dateSoon,
  normal: styles.dateNormal,
};

/** Non-milestone columns that the Columns menu can toggle. */
const FIELD_TOGGLES: { key: string; label: string }[] = [
  { key: "track", label: "Track" },
  { key: "period", label: "Period" },
  { key: "oe", label: "OE (Rp)" },
  { key: "qty", label: "Qty" },
  { key: "pnl", label: "P&L" },
];

const FIELD_TOGGLE_DEFAULTS: Record<string, boolean> = {
  // Visible by default: "which kind of tender is this" is not an optional extra,
  // it changes which milestones the row has at all.
  track: true,
  period: false,
  oe: false,
  qty: false,
  pnl: false,
};

/** Milestone labels are admin-authored and can be long ("Chemical Sample
 * Received at Lab Test"), which would blow up this deliberately dense table.
 * The full label stays available via the header's title attribute. */
const HEADER_MAX = 16;
function shortHeader(label: string): string {
  return label.length > HEADER_MAX
    ? label.slice(0, HEADER_MAX - 1).trimEnd() + "…"
    : label;
}

const priorityCards = [
  {
    key: "all",
    title: "Active tenders",
    caption: "Open packages",
    Icon: BriefcaseBusiness,
  },
  {
    key: "urgent",
    title: "Due within 3 days",
    caption: "Including today",
    Icon: CalendarClock,
  },
  {
    key: "planned",
    title: "Due in 4–14 days",
    caption: "Upcoming milestones",
    Icon: CalendarRange,
  },
  {
    key: "followup",
    title: "Needs follow-up",
    caption: "No upcoming milestone",
    Icon: CalendarOff,
  },
] as const;

const PAGE_SIZES = [25, 50, 100];

interface EditingCell {
  tenderId: string;
  column: string; // "result", or a milestone key
}

function SortIndicator({
  active,
  direction,
}: {
  active: boolean;
  direction: SortDirection;
}) {
  if (!active) return null;
  return (
    <span className={styles.sortArrow}>{direction === "asc" ? "▲" : "▼"}</span>
  );
}

export function TenderTableClient({
  tenders,
  options,
  milestoneTypes,
  anchor,
  isAdmin,
  canViewMoney = false,
  track,
  initialFilters = DEFAULT_FILTERS,
}: {
  tenders: RegisterTender[];
  options: FilterOptions;
  milestoneTypes: MilestoneType[];
  anchor: string;
  isAdmin: boolean;
  canViewMoney?: boolean;
  /** The track being shown. Carried into the export link so exporting cannot
   * silently dump the other track's tenders into the spreadsheet. */
  track: Track | "all";
  initialFilters?: TenderFilters;
}) {
  const router = useRouter();
  const matrixRef = useRef<HTMLDivElement>(null);
  const intentTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(intentTimer.current), []);
  const [filters, setFilters] = useState<TenderFilters>(initialFilters);
  // Keyed by column key rather than a fixed union: milestone keys are data now,
  // so an admin-added milestone needs a visibility slot without a code change.
  // The starting state comes from `milestone_types.show_in_table`.
  const defaultCols = useMemo(() => {
    const initial: Record<string, boolean> = { ...FIELD_TOGGLE_DEFAULTS };
    for (const m of milestoneTypes) initial[m.key] = m.showInTable;
    return initial;
  }, [milestoneTypes]);
  const [storedCols, saveCols] = useStoredJSON(
    `zekindo-columns:${track}`,
    defaultCols,
  );
  const visibleCols: Record<string, boolean> = { ...defaultCols };
  if (storedCols && typeof storedCols === "object")
    for (const key of Object.keys(defaultCols))
      if (typeof storedCols[key] === "boolean")
        visibleCols[key] = storedCols[key];
  // Restricted users receive no revenue values; drop the columns entirely.
  if (!canViewMoney) visibleCols.oe = false;
  function setVisibleCols(
    update: (previous: Record<string, boolean>) => Record<string, boolean>,
  ) {
    saveCols(update(visibleCols));
  }
  const [columnSearch, setColumnSearch] = useState("");
  const [compact, setCompact] = useStoredJSON("zekindo-matrix-compact", false);
  const columnChoices = [
    ...FIELD_TOGGLES.filter(
      (c) =>
        (c.key !== "track" || track === "all") &&
        (c.key !== "oe" || canViewMoney),
    ),
    ...milestoneTypes,
  ].filter((c) =>
    c.label.toLowerCase().includes(columnSearch.trim().toLowerCase()),
  );
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<{
    key: SortKey;
    direction: SortDirection;
  } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [quickEditError, setQuickEditError] = useState<string | null>(null);
  const [quickEditPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  const deferredFilters = useDeferredValue(filters);
  useEffect(() => {
    const query = tenderQuery(filters, track);
    const nextSearch = query ? `?${query}` : "";
    if (window.location.search !== nextSearch) {
      // Synchronize during the render's effect so a pending filter timer
      // cannot replace the URL after the user has opened a tender.
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${nextSearch}`,
      );
    }
  }, [filters, track]);
  useEffect(() => {
    function restore() {
      setFilters(
        readTenderFilters(new URLSearchParams(window.location.search)),
      );
      setPage(1);
      setSelected(new Set());
    }
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const resultRows = useMemo(
    () => filterTenders(tenders, deferredFilters),
    [tenders, deferredFilters],
  );
  const catalog = useMemo(
    () => ({
      upstream: milestoneTypes.filter(
        (milestone) => milestone.track === "upstream",
      ),
      downstream: milestoneTypes.filter(
        (milestone) => milestone.track === "downstream",
      ),
    }),
    [milestoneTypes],
  );
  const upcoming = useMemo(
    () =>
      new Map(
        tenders.map((tender) => [
          tender.id,
          tender.result ? null : nextMilestone(tender, anchor, catalog),
        ]),
      ),
    [tenders, anchor, catalog],
  );

  const filtered = useMemo(() => {
    const bucket = deferredFilters.deadline;
    if (!bucket || bucket === "all") return resultRows;
    return resultRows.filter(
      (t) => !t.result && deadlineBucket(upcoming.get(t.id)?.diff) === bucket,
    );
  }, [resultRows, deferredFilters.deadline, upcoming]);

  const priorityCounts = useMemo(() => {
    const counts = { all: 0, urgent: 0, planned: 0, followup: 0, later: 0 };
    for (const tender of filterTenders(tenders, {
      ...deferredFilters,
      result: "__EMPTY__",
    })) {
      counts.all++;
      counts[deadlineBucket(upcoming.get(tender.id)?.diff)]++;
    }
    return counts;
  }, [deferredFilters, tenders, upcoming]);
  const sorted = useMemo(
    () =>
      sort
        ? sortTenders(filtered, sort.key, sort.direction)
        : [...filtered].sort((a, b) =>
            (upcoming.get(a.id)?.date ?? "9999").localeCompare(
              upcoming.get(b.id)?.date ?? "9999",
            ),
          ),
    [filtered, sort, upcoming],
  );

  // Clamped rather than reset-via-effect: whenever filtering/sorting shrinks
  // the result set below the current page, this naturally lands on the last
  // valid page instead of showing an empty page.
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageItems = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize],
  );

  const visibleMilestones = milestoneTypes.filter((m) => visibleCols[m.key]);

  function changeFilters(update: (previous: TenderFilters) => TenderFilters) {
    setFilters(update);
    setPage(1);
    setSelected(new Set());
  }

  const [expanded, setExpanded] = useState("");
  const [returnedRow, setReturnedRow] = useState("");
  const scope = tenderQuery(filters, track);
  function returnHash(id: string) {
    return "#resume-" + encodeURIComponent(id);
  }
  function rememberRow(id: string) {
    try {
      sessionStorage.setItem(
        "tender-register-position",
        JSON.stringify({
          id,
          scope,
          page: safePage,
          pageSize,
          sort,
          x: matrixRef.current?.scrollLeft ?? 0,
          y: matrixRef.current?.scrollTop ?? 0,
          windowY: window.scrollY,
        }),
      );
      window.history.replaceState(
        window.history.state,
        "",
        location.pathname + location.search + returnHash(id),
      );
    } catch {
      /* Navigation also works without browser storage. */
    }
  }
  useEffect(() => {
    if (!location.hash.startsWith("#resume-")) return;
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const saved = JSON.parse(
        sessionStorage.getItem("tender-register-position") ?? "null",
      );
      if (
        !saved ||
        saved.scope !== scope ||
        returnHash(saved.id) !== location.hash ||
        !PAGE_SIZES.includes(saved.pageSize)
      )
        return;
      frame = requestAnimationFrame(() => {
        flushSync(() => {
          setPageSize(saved.pageSize);
          setPage(saved.page);
          setSort(saved.sort);
          setReturnedRow(saved.id);
        });
        matrixRef.current?.scrollTo(saved.x, saved.y);
        window.scrollTo(0, saved.windowY);
        history.replaceState(
          history.state,
          "",
          location.pathname + location.search,
        );
      });
      timer = setTimeout(() => setReturnedRow(""), 2200);
    } catch {
      /* Ignore expired or unreadable preferences. */
    }
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [scope]);

  function tenderHref(id: string) {
    const path = "/tenders" + (scope ? "?" + scope : "") + returnHash(id);
    return `/tenders/${id}?${new URLSearchParams({ returnTo: path })}`;
  }
  const filterLabels = {
    area: "Area",
    period: "Period",
    entitas: "Entity",
    customer: "Customer",
    result: "Status",
    deadline: "Deadline",
    search: "Search",
  };
  const chips = (
    Object.keys(filterLabels) as (keyof typeof filterLabels)[]
  ).filter((key) => filters[key] && filters[key] !== "all");

  function resetFilters() {
    changeFilters(() => DEFAULT_FILTERS);
  }

  // ── Bulk selection ──────────────────────────────────────────────────────
  const pageIds = pageItems.map((t) => t.id);
  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function runBulk() {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    setBulkMessage(null);
    setQuickEditError(null);
    try {
      const result = await bulkArchiveTenders(ids);
      if (result.error) {
        setQuickEditError(result.error);
        return;
      }
      setSelected(new Set());
      setBulkMessage(
        `${result.count} tender${result.count === 1 ? "" : "s"} archived.`,
      );
      router.refresh();
    } catch {
      setQuickEditError(
        "Could not complete the bulk action. Please try again.",
      );
    } finally {
      setBulkBusy(false);
    }
  }

  const exportHref = `/tenders/export?${tenderQuery(filters, track)}`;

  function toggleSort(key: SortKey) {
    setSort((s) => {
      if (!s || s.key !== key) return { key, direction: "asc" };
      if (s.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }

  function handleQuickResult(tenderId: string, result: string) {
    setEditingCell(null);
    setQuickEditError(null);
    startTransition(async () => {
      const result_ = await quickUpdateResult(tenderId, result);
      if (result_?.error) setQuickEditError(result_.error);
    });
  }

  function handleQuickMilestone(tenderId: string, key: string, value: string) {
    setQuickEditError(null);
    startTransition(async () => {
      const result = await quickUpdateMilestone(tenderId, key, value);
      if (result?.error) setQuickEditError(result.error);
    });
  }

  function sortableHeader(
    key: SortKey,
    label: string,
    align: "left" | "right" = "left",
    title?: string,
  ) {
    return (
      <TableHead
        key={key}
        scope="col"
        data-column={key}
        aria-sort={
          sort?.key === key
            ? sort.direction === "asc"
              ? "ascending"
              : "descending"
            : "none"
        }
        className={`${styles.th} ${key === "product" ? styles.stickyIdentity : ""} ${align === "right" ? styles.thRight : ""} ${styles.thSortable}`}
        title={title}
      >
        <Button
          variant="ghost"
          type="button"
          className={styles.sortButton}
          onClick={() => toggleSort(key)}
        >
          {label}
          <SortIndicator
            active={sort?.key === key}
            direction={sort?.direction ?? "asc"}
          />
        </Button>
      </TableHead>
    );
  }

  return (
    <div className={styles.wrap}>
      <OperationsHeading
        title="Tender register"
        context={
          <>
            Schedule matrix · {filtered.length} of {tenders.length} tenders
            {sort ? "" : " · Next deadline first"}
          </>
        }
        actions={
          isAdmin ? (
            <Button asChild variant="default">
              <Link
                prefetch={true}
                href={
                  track === "downstream"
                    ? "/tenders/new?track=downstream"
                    : "/tenders/new"
                }
              >
                <Icon name="plus" width={16} height={16} /> New tender
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className={styles.priorities} aria-label="Deadline priorities">
        {priorityCards.map(({ key, title, caption, Icon: Glyph }) => (
          <button
            key={key}
            type="button"
            className={styles.priority}
            data-kind={key}
            aria-pressed={
              filters.result === "__EMPTY__" &&
              (filters.deadline ?? "all") === key
            }
            onClick={() =>
              changeFilters((f) => ({
                ...f,
                result: "__EMPTY__",
                deadline: key,
              }))
            }
          >
            <span>
              <Glyph size={16} />
              {title}
            </span>
            <strong>{priorityCounts[key]}</strong>
            <small>{caption}</small>
          </button>
        ))}
      </div>
      <div className={styles.scopes}>
        <Tabs
          value={filters.result}
          onValueChange={(result) =>
            changeFilters((f) => ({ ...f, result, deadline: "all" }))
          }
        >
          <TabsList aria-label="Tender outcomes">
            <TabsTrigger value="all">All results</TabsTrigger>
            <TabsTrigger value="__EMPTY__">Active</TabsTrigger>
            <TabsTrigger value="WIN">Won</TabsTrigger>
          </TabsList>
        </Tabs>
        <TrackSwitch
          current={track}
          basePath="/tenders"
          params={Object.fromEntries(
            new URLSearchParams(tenderQuery(filters, track)),
          )}
        />
      </div>
      <div className={styles.tableWorkspace}>
        <div className={styles.commandBar}>
          <div className={styles.searchField}>
            <Icon name="search" />
            <Input
              aria-label="Search tenders"
              type="search"
              className={styles.search}
              placeholder="Search tenders…"
              value={filters.search}
              onChange={(e) =>
                changeFilters((f) => ({ ...f, search: e.target.value }))
              }
            />
          </div>
          <Button
            variant="outline"
            type="button"
            className={styles.filterToggle}
            aria-expanded={showFilters}
            onClick={() => setShowFilters((value) => !value)}
          >
            <ListFilter /> {showFilters ? "Hide filters" : "Filters"}
          </Button>
          {pageItems.length > 0 && visibleMilestones.length > 0 && (
            <NativeSelect
              aria-label="Jump to milestone"
              value=""
              onChange={(event) => {
                const region = matrixRef.current;
                if (!region) return;
                const header = region.querySelector<HTMLElement>(
                  `th[data-column="${CSS.escape(event.target.value)}"]`,
                );
                if (!header) return;
                const pinned = region.querySelector(
                  'th[data-column="product"]',
                );
                region.scrollLeft +=
                  header.getBoundingClientRect().left -
                  region.getBoundingClientRect().left -
                  (pinned?.getBoundingClientRect().width ?? 0);
                header.querySelector("button")?.focus({ preventScroll: true });
              }}
            >
              <NativeSelectOption value="" disabled>
                Jump to milestone…
              </NativeSelectOption>
              {visibleMilestones.map((m) => (
                <NativeSelectOption key={m.key} value={m.key}>
                  {m.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
          <div className={styles.colMenuWrap}>
            <Popover
              onOpenChange={(open) => {
                if (!open) setColumnSearch("");
              }}
            >
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <Columns3 /> Columns
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                collisionPadding={12}
                aria-label="Visible columns"
                className="max-h-80 w-60 overflow-y-auto p-3"
              >
                <Input
                  type="search"
                  aria-label="Find a column"
                  placeholder="Find a column…"
                  value={columnSearch}
                  onChange={(event) => setColumnSearch(event.target.value)}
                />
                <div className={styles.columnChoices}>
                  {columnChoices.map((c) => (
                    <Label key={c.key} className={styles.colMenuItem}>
                      <Checkbox
                        checked={!!visibleCols[c.key]}
                        onCheckedChange={() =>
                          setVisibleCols((v) => ({ ...v, [c.key]: !v[c.key] }))
                        }
                      />
                      {c.label}
                    </Label>
                  ))}
                  {!columnChoices.length && (
                    <p role="status">No matching columns.</p>
                  )}
                </div>
                <Label className={styles.colMenuItem}>
                  <Checkbox
                    checked={compact === true}
                    onCheckedChange={(value) => setCompact(value === true)}
                  />
                  Compact rows
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    saveCols(defaultCols);
                    setColumnSearch("");
                  }}
                >
                  Restore default columns
                </Button>
              </PopoverContent>
            </Popover>
          </div>
          {isAdmin && (
            <Button asChild variant="outline" size="icon">
              <a
                href={exportHref}
                aria-label="Export to Excel"
                title="Export to Excel"
                className={styles.exportAction}
              >
                <Icon name="download" width={16} height={16} />
              </a>
            </Button>
          )}
        </div>
        {(chips.length > 0 || track !== "all") && (
          <div className={styles.filterChips} aria-label="Active filters">
            {track !== "all" && (
              <button
                aria-label="Remove track filter"
                onClick={() =>
                  history.pushState(
                    null,
                    "",
                    "/tenders?" + tenderQuery(filters, "all"),
                  )
                }
              >
                {TRACK_LABELS[track]} ×
              </button>
            )}
            {chips.map((key) => (
              <button
                key={key}
                aria-label={`Remove ${filterLabels[key]} filter`}
                onClick={() =>
                  changeFilters((f) => ({ ...f, [key]: DEFAULT_FILTERS[key] }))
                }
              >
                {filterLabels[key]}:{" "}
                {filters[key] === "__EMPTY__" ? "Active" : filters[key]} ×
              </button>
            ))}
          </div>
        )}
        {showFilters && (
          <div className={styles.advanced}>
            <NativeSelect
              className={styles.select}
              aria-label="Period"
              value={filters.period}
              onChange={(e) =>
                changeFilters((f) => ({ ...f, period: e.target.value }))
              }
            >
              <NativeSelectOption value="all">All Periods</NativeSelectOption>
              {options.periods.map((p) => (
                <NativeSelectOption key={p} value={p}>
                  {p}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect
              className={styles.select}
              aria-label="Area"
              value={filters.area}
              onChange={(e) =>
                changeFilters((f) => ({ ...f, area: e.target.value }))
              }
            >
              <NativeSelectOption value="all">All Areas</NativeSelectOption>
              {options.areas.map((a) => (
                <NativeSelectOption key={a} value={a}>
                  {a}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect
              className={styles.select}
              aria-label="Entity"
              value={filters.entitas}
              onChange={(e) =>
                changeFilters((f) => ({ ...f, entitas: e.target.value }))
              }
            >
              <NativeSelectOption value="all">All Entities</NativeSelectOption>
              {options.entitasList.map((en) => (
                <NativeSelectOption key={en} value={en}>
                  {en}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect
              className={styles.select}
              aria-label="Customer"
              value={filters.customer}
              onChange={(e) =>
                changeFilters((f) => ({ ...f, customer: e.target.value }))
              }
            >
              <NativeSelectOption value="all">All Customers</NativeSelectOption>
              {options.customers.map((c) => (
                <NativeSelectOption key={c} value={c}>
                  {c}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect
              className={styles.select}
              aria-label="Result"
              value={filters.result}
              onChange={(e) =>
                changeFilters((f) => ({
                  ...f,
                  deadline: "all",
                  result: e.target.value,
                }))
              }
            >
              <NativeSelectOption value="all">All Results</NativeSelectOption>
              <NativeSelectOption value="__EMPTY__">
                (Running / no result)
              </NativeSelectOption>
              {RESULT_ENUM.map((r) => (
                <NativeSelectOption key={r} value={r}>
                  {r}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <TableViews
              track={track}
              filters={filters}
              onApply={(next) => changeFilters(() => next)}
            />
            <Button
              variant="ghost"
              className={styles.resetButton}
              onClick={resetFilters}
            >
              Reset filters
            </Button>
          </div>
        )}

        {isAdmin && selected.size > 0 && (
          <div className={styles.bulkBar}>
            <span className={styles.bulkCount}>{selected.size} selected</span>
            <Button
              variant="ghost"
              className={styles.bulkGhost}
              onClick={() => setSelected(new Set())}
              disabled={bulkBusy}
            >
              Clear
            </Button>
            <span className={styles.bulkSpacer} />
            <Button
              variant="default"
              className={styles.bulkButton}
              onClick={() => setArchiveConfirm(true)}
              disabled={bulkBusy}
            >
              Archive selected
            </Button>
          </div>
        )}

        {bulkMessage && (
          <div role="status" className={styles.bulkMessage}>
            {bulkMessage}
          </div>
        )}

        {quickEditError && (
          <Alert variant="destructive">
            <AlertDescription>{quickEditError}</AlertDescription>
          </Alert>
        )}

        {pageItems.length > 0 ? (
          <div
            ref={matrixRef}
            className={styles.scroll}
            tabIndex={0}
            role="region"
            aria-label="Schedule matrix"
          >
            {(["upstream","downstream"] as const).map(group => {
              const groupRows = pageItems.filter(t => t.track === group);
              if (!groupRows.length) return null;
              const columns = visibleMilestones.filter(m => m.track === group);
              const columnKeys = new Set(columns.map(m => m.key));
              const templateKeys = new Set(milestoneTypes.map(m => m.key));
              const columnCount = columns.length + (canViewMoney ? 7 : 6) + [isAdmin, visibleCols.track && track === "all",
                track !== "downstream", visibleCols.period, visibleCols.oe, visibleCols.qty, visibleCols.pnl].filter(Boolean).length;
              return <Fragment key={group}>
              {track === "all" && <h2 className="sticky left-0 px-3 py-2 font-semibold">{TRACK_LABELS[group]}</h2>}
            <Table className={styles.table} data-compact={compact === true}>
              <TableHeader>
                <TableRow className={styles.theadRow}>
                  {isAdmin && (
                    <TableHead className={`${styles.th} ${styles.checkboxCol}`}>
                      <Checkbox
                        className={styles.checkbox}
                        checked={
                          allOnPageSelected ||
                          (pageIds.some((id) => selected.has(id))
                            ? "indeterminate"
                            : false)
                        }
                        onCheckedChange={toggleAllOnPage}
                        title="Select every row on this page"
                        aria-label="Select every row on this page"
                      />
                    </TableHead>
                  )}
                  {sortableHeader("product", "Package")}
                  {sortableHeader("customer", "Customer")}
                  {sortableHeader("result", "Status")}
                  {columns.map((m) =>
                    sortableHeader(
                      m.key,
                      shortHeader(m.label),
                      "left",
                      m.label,
                    ),
                  )}
                  {sortableHeader("tenderNo", "Tender No.")}
                  {sortableHeader("rowNo", "No")}
                  {visibleCols.track && track === "all" && (
                    <TableHead scope="col" className={styles.th}>
                      Track
                    </TableHead>
                  )}
                  {sortableHeader("area", "Area")}
                  {track !== "downstream" &&
                    sortableHeader("entitas", "Entity")}
                  {visibleCols.period && sortableHeader("period", "Period")}
                  {visibleCols.oe && sortableHeader("oe", "OE (Rp)", "right")}
                  {visibleCols.qty && sortableHeader("qty", "Qty", "right")}
                  {canViewMoney &&
                    sortableHeader("nilaiPenawaran", "Bid Value", "right")}
                  {visibleCols.pnl && sortableHeader("pnl", "P&L")}
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupRows.map(t => {
                  const stages = resolveTenderMilestones(t, catalog);
                  const extras = new Map<string, number>();
                  let previous = "";
                  for (const stage of stages) {
                    if (columnKeys.has(stage.key)) previous = stage.key;
                    else if (!templateKeys.has(stage.key)) extras.set(previous, (extras.get(previous) ?? 0) + 1);
                  }
                  const toggle = (key: string) => {
                    const count = extras.get(key);
                    if (!count) return null;
                    return <button type="button" className="ml-1 text-primary underline" aria-expanded={expanded === t.id}
                      aria-label={`Show ${count} additional stages for ${t.tenderNo || t.id}`}
                      onClick={e => { e.stopPropagation(); setExpanded(expanded === t.id ? "" : t.id); }}>+{count}</button>;
                  };
                  return <Fragment key={t.id}>
                  <TableRow
                    key={t.id}
                    className={`${styles.bodyRow} ${selected.has(t.id) ? styles.rowSelected : ""}`}
                    onPointerEnter={(event) => {
                      if (event.pointerType !== "mouse") return;
                      clearTimeout(intentTimer.current);
                      intentTimer.current = setTimeout(
                        () => router.prefetch(tenderHref(t.id)),
                        100,
                      );
                    }}
                    onPointerLeave={() => clearTimeout(intentTimer.current)}
                    data-returned={returnedRow === t.id || undefined}
                    onClick={() => {
                      rememberRow(t.id);
                      router.push(tenderHref(t.id));
                    }}
                  >
                    {isAdmin && (
                      <TableCell
                        className={`${styles.td} ${styles.checkboxCol}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          className={styles.checkbox}
                          checked={selected.has(t.id)}
                          onCheckedChange={() => toggleRow(t.id)}
                          aria-label={`Select tender ${t.tenderNo || t.id}`}
                        />
                      </TableCell>
                    )}
                    <TableCell
                      className={`${styles.td} ${styles.stickyIdentity} ${styles.packageCell}`}
                    >
                      <Link
                        prefetch={false}
                        href={tenderHref(t.id)}
                        title={t.product || t.customer || "View tender"}
                        onFocus={() => router.prefetch(tenderHref(t.id))}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (
                            !event.ctrlKey &&
                            !event.metaKey &&
                            !event.shiftKey &&
                            !event.altKey
                          )
                            rememberRow(t.id);
                        }}
                      >
                        {t.product || t.customer || "View tender"}
                      </Link>
                      <small className={styles.packageNumber}>
                        {t.tenderNo || `Tender #${t.rowNo}`}
                      </small>
                      {upcoming.get(t.id) && <small className={styles.packageNumber}>Next: {upcoming.get(t.id)?.label} · {formatDateID(upcoming.get(t.id)?.date)}</small>}
                      {toggle("")}
                      {!extras.size && <button type="button" className="text-xs text-primary" aria-expanded={expanded === t.id}
                        onClick={e => { e.stopPropagation(); setExpanded(expanded === t.id ? "" : t.id); }}>Schedule</button>}
                    </TableCell>
                    <TableCell
                      className={`${styles.td} ${styles.tdEllipsis}`}
                      style={{ maxWidth: 220 }}
                      title={t.customer}
                    >
                      {t.customer || "—"}
                    </TableCell>
                    <TableCell
                      className={`${styles.td} ${styles.statusCell}`}
                      title={t.result || "Running"}
                    >
                      {isAdmin &&
                      editingCell?.tenderId === t.id &&
                      editingCell.column === "result" ? (
                        <NativeSelect
                          aria-label={`Edit result for ${t.tenderNo || t.id}`}
                          autoFocus
                          defaultValue={t.result ?? ""}
                          className={styles.inlineSelect}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            handleQuickResult(t.id, e.target.value)
                          }
                          onBlur={() => setEditingCell(null)}
                        >
                          <NativeSelectOption value="">
                            (Running)
                          </NativeSelectOption>
                          {RESULT_ENUM.map((r) => (
                            <NativeSelectOption key={r} value={r}>
                              {r}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      ) : isAdmin ? (
                        <Button
                          variant="ghost"
                          type="button"
                          className={styles.cellButton}
                          disabled={quickEditPending}
                          aria-description={t.result || "Running"}
                          aria-label={`Edit result for ${t.tenderNo || t.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCell({
                              tenderId: t.id,
                              column: "result",
                            });
                          }}
                        >
                          <ResultBadge result={t.result} />
                        </Button>
                      ) : (
                        <ResultBadge result={t.result} />
                      )}
                    </TableCell>
                    {columns.map((m) => {
                      if (
                        t.track !== m.track ||
                        (t.milestoneOrder && !t.milestoneOrder.includes(m.key))
                      ) {
                        return (
                          <TableCell
                            key={m.key}
                            className={`${styles.dateCell} ${styles.notApplicable}`}
                            aria-label="Not part of this tender’s schedule"
                            title="Not part of this tender’s schedule"
                          >
                            <span aria-hidden="true">—</span>
                          </TableCell>
                        );
                      }
                      const iso = t.milestones[m.key] ?? null;
                      const tone = dateTone(iso, t.result, anchor);
                      const next = upcoming.get(t.id);
                      const nearest = next?.key === m.key ? next : null;
                      const dateLabel = iso ? formatDateID(iso) : "Not set";
                      const isEditing =
                        isAdmin &&
                        editingCell?.tenderId === t.id &&
                        editingCell.column === m.key;
                      if (isEditing) {
                        return (
                          <TableCell
                            key={m.key}
                            className={styles.dateCell}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Input
                              type="date"
                              aria-label={`Edit ${m.label} for ${t.tenderNo || t.id}`}
                              autoFocus
                              defaultValue={iso ?? ""}
                              className={styles.inlineDateInput}
                              onChange={(e) =>
                                handleQuickMilestone(
                                  t.id,
                                  m.key,
                                  e.target.value,
                                )
                              }
                              onBlur={() => setEditingCell(null)}
                            />
                          </TableCell>
                        );
                      }
                      return (
                        <TableCell
                          key={m.key}
                          className={`${styles.dateCell} ${DATE_TONE_CLASS[tone]} ${isAdmin ? styles.editableCell : ""}`}
                          data-next={nearest ? true : undefined}
                          title={isAdmin ? `Click to edit ${m.label}` : m.label}
                        >
                          {isAdmin ? (
                            <Button
                              variant="ghost"
                              type="button"
                              className={styles.cellButton}
                              disabled={quickEditPending}
                              aria-label={`Edit ${m.label} for ${t.tenderNo || t.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCell({
                                  tenderId: t.id,
                                  column: m.key,
                                });
                              }}
                            >
                              {dateLabel}
                            </Button>
                          ) : (
                            dateLabel
                          )}
                          {toggle(m.key)}
                          {!!t.meetingCounts?.[m.key] && <MeetingLink className="flex items-center gap-1 text-xs text-primary underline" href={`/tenders/${t.id}/meetings?${new URLSearchParams({milestone:m.key})}`}><CalendarRange size={13} aria-hidden />{plural(t.meetingCounts[m.key], "meeting")}</MeetingLink>}
                          {nearest && (
                            <small className={styles.nextDate}>
                              {nearest.diff === 0
                                ? "Today"
                                : nearest.diff === 1
                                  ? "Tomorrow"
                                  : `In ${nearest.diff} days`}
                            </small>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className={`${styles.td} ${styles.tdNoWrap}`}>
                      {t.tenderNo ? (
                        <Link
                          prefetch={false}
                          href={tenderHref(t.id)}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (
                              !event.ctrlKey &&
                              !event.metaKey &&
                              !event.shiftKey &&
                              !event.altKey
                            )
                              rememberRow(t.id);
                          }}
                        >
                          {t.tenderNo}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className={`${styles.td} ${styles.tdMuted}`}>
                      {t.rowNo}
                    </TableCell>
                    {visibleCols.track && (track as string) === "all" && (
                      <TableCell className={`${styles.td} ${styles.tdNoWrap}`}>
                        {t.track === "downstream" ? (
                          <TrackBadge track={t.track} />
                        ) : (
                          <span style={{ color: "var(--color-fg3)" }}>
                            {TRACK_LABELS.upstream}
                          </span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className={styles.td}>{t.area}</TableCell>
                    {track !== "downstream" && (
                      <TableCell className={`${styles.td} ${styles.tdNoWrap}`}>
                        {t.entitas || "—"}
                      </TableCell>
                    )}
                    {visibleCols.period && (
                      <TableCell className={styles.td}>{t.period}</TableCell>
                    )}
                    {visibleCols.oe && (
                      <TableCell className={`${styles.td} ${styles.tdRight}`}>
                        <MoneyValue value={t.oe} canView />
                      </TableCell>
                    )}
                    {visibleCols.qty && (
                      <TableCell className={`${styles.td} ${styles.tdRight}`}>
                        {t.qty ?? "—"}
                      </TableCell>
                    )}
                    {canViewMoney && (
                      <TableCell className={`${styles.td} ${styles.tdRight}`}>
                        <MoneyValue value={t.nilaiPenawaran} canView />
                      </TableCell>
                    )}
                    {visibleCols.pnl && (
                      <TableCell className={styles.td}>
                        {t.pnl ? "Yes" : "—"}
                      </TableCell>
                    )}
                  </TableRow>
                  {expanded === t.id && <TableRow><TableCell colSpan={columnCount}>
                    <ol className="grid gap-2 p-3">{stages.map(stage => <li key={stage.key}>{stage.label} · {formatDateID(stage.date) || "Not scheduled"}</li>)}</ol>
                    <Link className="text-primary underline" href={tenderHref(t.id)}>Open tender</Link>
                  </TableCell></TableRow>}
                  </Fragment>;
                })}
              </TableBody>
            </Table></Fragment>;
            })}
          </div>
        ) : null}
        {pageItems.length > 0 && (
          // Phones: a readable card per tender instead of the wide matrix.
          <ul className={styles.phoneCards} aria-label="Tenders">
            {pageItems.map((t) => {
              const next = upcoming.get(t.id);
              const tone = next
                ? next.diff <= 3
                  ? "urgent"
                  : next.diff <= 14
                    ? "soon"
                    : "later"
                : "none";
              return (
                <li key={t.id}>
                  <Link
                    prefetch={false}
                    href={tenderHref(t.id)}
                    className={styles.phoneCard}
                    onClick={() => rememberRow(t.id)}
                  >
                    <span className={styles.phoneCardTop}>
                      <ResultBadge result={t.result} />
                      {track === "all" && t.track === "downstream" && (
                        <span className={styles.phoneTrack}>Downstream</span>
                      )}
                    </span>
                    <strong className={styles.phoneTitle}>
                      {t.product || t.customer || "Untitled tender"}
                    </strong>
                    <span className={styles.phoneMeta}>
                      {t.customer}
                      {t.tenderNo ? ` · ${t.tenderNo}` : ""}
                    </span>
                    {next ? (
                      <span className={styles.phoneNext} data-tone={tone}>
                        <span className={styles.phoneDays}>
                          {next.diff === 0 ? "Today" : `D-${next.diff}`}
                        </span>
                        {next.label} · {formatDateID(next.date)}
                      </span>
                    ) : (
                      !t.result && (
                        <span className={styles.phoneNext} data-tone="none">
                          No upcoming milestone
                        </span>
                      )
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {pageItems.length === 0 && (
          <div className={styles.emptyBox}>
            <div className={styles.emptyText}>
              No tenders match this filter.
            </div>
            <Button
              variant="ghost"
              className={styles.emptyReset}
              onClick={resetFilters}
            >
              Reset filters
            </Button>
          </div>
        )}

        {sorted.length > 0 && (
          <div className={styles.pagination}>
            <div className={styles.pageSizeGroup}>
              <span>Rows per page</span>
              <NativeSelect
                aria-label="Rows per page"
                className={styles.select}
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {PAGE_SIZES.map((size) => (
                  <NativeSelectOption key={size} value={size}>
                    {size}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className={styles.pageNav}>
              <Button
                variant="outline"
                className={styles.pageButton}
                disabled={safePage <= 1}
                onClick={() => setPage(Math.max(1, safePage - 1))}
              >
                Previous
              </Button>
              <span className={styles.pageLabel}>
                Page {safePage} of {pageCount}
              </span>
              <Button
                variant="outline"
                className={styles.pageButton}
                disabled={safePage >= pageCount}
                onClick={() => setPage(Math.min(pageCount, safePage + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
      <Modal
        open={archiveConfirm}
        title={`Archive ${selected.size} selected tenders?`}
        onClose={() => {
          if (!bulkBusy) setArchiveConfirm(false);
        }}
      >
        <p className="muted">
          They will leave active lists and analytics. You can restore them from
          Archive at any time.
        </p>
        <div className="dialog-actions">
          <Button
            variant="outline"
            onClick={() => setArchiveConfirm(false)}
            disabled={bulkBusy}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            disabled={bulkBusy}
            onClick={() => {
              setArchiveConfirm(false);
              void runBulk();
            }}
          >
            Confirm archive
          </Button>
        </div>
      </Modal>
    </div>
  );
}
