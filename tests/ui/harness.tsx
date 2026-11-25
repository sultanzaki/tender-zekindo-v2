import { LoginForm } from "../../src/components/LoginForm";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { TopNav } from "../../src/components/TopNav";
import { readTenderFilters } from "../../src/lib/table-state";
import { TenderTableClient } from "../../src/components/TenderTableClient";
import { EditTenderForm } from "../../src/components/EditTenderForm";
import { ArchiveAction } from "../../src/components/ArchiveAction";
import { DeadlineWorkspace } from "../../src/components/DeadlineWorkspace";
import { MilestoneAdmin } from "../../src/components/MilestoneAdmin";
import { NewTenderForm } from "../../src/components/NewTenderForm";
import { ManageUsersClient } from "../../src/components/ManageUsersClient";
import { NumberInput } from "../../src/components/NumberInput";
import { DocumentExplorer } from "../../src/components/DocumentExplorer";
import { MoneyValue } from "../../src/components/MoneyValue";
import { MilestoneNote } from "../../src/components/MilestoneNote";
import { CalendarWorkspace } from "../../src/components/CalendarWorkspace";
import { buildCalendarEvents, monthGrid } from "../../src/lib/calendar-events";
import { KpiCards } from "../../src/components/charts/KpiCards";
import { TrackComparisonChart } from "../../src/components/charts/TrackComparisonChart";
import type { Tender, Profile } from "../../src/lib/types";
import "../../src/app/globals.css";
const user: Profile = {
  id: "admin",
  name: "Test Admin",
  email: "admin@example.test",
  role: "admin",
  createdAt: "",
};
const tenders = Array.from(
  { length: 120 },
  (_, i) =>
    ({
      id: String(i),
      rowNo: i + 1,
      track: "upstream",
      period: "2026",
      area: "Jawa",
      tenderNo: `TN-${i + 1}`,
      customer: "Customer",
      product: `Package ${i + 1}`,
      entitas: "ZKI",
      milestones: {},
      milestoneOrder: null,
      result: null,
      pnl: false,
      archivedAt: null,
    }) as Tender,
);
function NumberDemo() {
  const [value, setValue] = useState("123.45");
  return (
    <label>
      Amount
      <NumberInput value={value} onChange={setValue} />
      <output>{value}</output>
    </label>
  );
}
function FinancialDemo({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      <div data-testid="money-field">
        <MoneyValue value={1234567.89} canView={signedIn} />
      </div>
      <KpiCards
        canViewMoney={signedIn}
        data={{
          pipelineValue: 1234567.89,
          winValue: 987654.32,
          runningCount: 12,
          winRatePct: 60,
          winCount: 6,
          lossCount: 4,
          decidedCount: 10,
        }}
      />
      <TrackComparisonChart
        canViewMoney={signedIn}
        data={[
          {
            track: "upstream",
            label: "Upstream",
            count: 12,
            pipelineValue: 1234567.89,
            winValue: 987654.32,
            winRate: 60,
          },
        ]}
      />
      <TenderTableClient
        tenders={[
          {
            ...tenders[0],
            oe: signedIn ? 1234567.89 : null,
            nilaiPenawaran: signedIn ? 987654.32 : null,
            qty: 12.5,
          },
        ]}
        options={{
          periods: ["2026"],
          areas: ["Jawa"],
          entitasList: ["ZKI"],
          customers: ["Customer"],
        }}
        milestoneTypes={[]}
        anchor="2026-10-22"
        isAdmin={false}
        canViewMoney={signedIn}
        track="upstream"
      />
    </>
  );
}
const calendarDays = monthGrid("2026-11");
const calendarTenders = [
  ["Production Chemical Supply", "Contoh Energi Tbk", "upstream", { regist: "2026-11-02", pq: "2026-11-09", prebid: "2026-11-26", openBid: "2026-12-03" }, null],
  ["Demulsifier for Field A", "Sampel Migas", "upstream", { regist: "2026-11-05", technicalBidding: "2026-11-24", fieldTest: "2026-11-27" }, null],
  ["Scale Inhibitor Retender", "Ilustrasi Petro", "upstream", { pq: "2026-11-12", pemasukanDokumen: "2026-11-25", openBid: "2026-11-30" }, null],
  ["Water Treatment Package", "Kimia Nusantara", "downstream", { dsPendaftaran: "2026-11-03", dsBidding: "2026-11-25", dsNegosiasi1: "2026-12-01" }, null],
  ["H2S Scavenger Supply", "Energi Contoh", "upstream", { regist: "2026-11-10", openBid: "2026-11-18" }, "WIN"],
  ["Corrosion Inhibitor", "Migas Ilustrasi", "upstream", { prebid: "2026-11-16", technicalBidding: "2026-11-20" }, null],
  ["Boiler Feed Water Chemicals", "Sampel Daya", "downstream", { dsPrakualifikasi: "2026-11-25", dsPrebid: "2026-11-25" }, null],
] as const;
const calendarEvents = buildCalendarEvents(
  calendarTenders.map(([product, customer, track, milestones, result], i) => ({
    id: `C${i}`, track, tenderNo: `DEMO-${i}`, customer, product, milestones: { ...milestones },
    milestoneLabels: Object.fromEntries(Object.keys(milestones).map((k) => [k, ({
      regist: "Registration", pq: "PQ", prebid: "Prebid", openBid: "Open Bid", technicalBidding: "Technical Bidding",
      fieldTest: "Field Test", pemasukanDokumen: "Bid Document Submission", dsPendaftaran: "Pendaftaran",
      dsBidding: "Bidding", dsNegosiasi1: "Negosiasi 1", dsPrakualifikasi: "Prakualifikasi", dsPrebid: "Prebid" } as Record<string, string>)[k]])),
    milestoneOrder: Object.keys(milestones), result,
  })),
  [
    { id: "g1", tenderId: "C0", milestone: "prebid", topic: "Prebid prep with tech team", startsAt: "2026-11-25T02:00:00Z" },
    { id: "g2", tenderId: "C2", milestone: "pemasukanDokumen", topic: "Final document review", startsAt: "2026-11-24T07:30:00Z" },
    { id: "g3", tenderId: "C3", milestone: "dsBidding", topic: "Pricing alignment", startsAt: "2026-11-19T03:00:00Z" },
  ],
  { from: calendarDays[0], to: calendarDays[41], today: "2026-11-25" },
);
const components = {
  calendar: <CalendarWorkspace month="2026-11" days={calendarDays} today="2026-11-25" events={calendarEvents} />,
  "milestone-note": (
    <>
      <MilestoneNote tenderId="t" milestoneKey="prebid" label="Prebid" canEdit />
      <div data-testid="reader">
        <MilestoneNote tenderId="t" milestoneKey="pq" label="PQ" note="Read me" canEdit={false} />
      </div>
    </>
  ),
  "guest-money": <FinancialDemo signedIn={false} />,
  "viewer-money": <FinancialDemo signedIn />,
  nav: (
    <>
      <TopNav profile={user}>
        <div style={{ height: 400 }}>Page content</div>
      </TopNav>
    </>
  ),
  table: (
    <TenderTableClient
      tenders={new URLSearchParams(location.search).has("audit") ? tenders.map((t,i) => ({
        ...t,
        product: ["Production Chemical Supply for Offshore Operations", "Laboratory Testing Services", "Water Treatment Chemicals"][i % 3],
        customer: ["Petrochemical Indonesia", "Energi Nusantara"][i % 2],
        result: i % 2 ? null : "LOSS TECHNICAL (BOTTLE TEST)",
        milestones: {site: i % 2 ? null : "2026-10-20"},
      })) : tenders}
      initialFilters={readTenderFilters(
        new URLSearchParams(window.location.search),
      )}
      options={{
        periods: ["2026"],
        areas: ["Jawa"],
        entitasList: ["ZKI"],
        customers: ["Customer"],
      }}
      milestoneTypes={[{ id: "site", key: "site", label: "Site visit", track: "upstream", showInTable: true, sortOrder: 0 }]}
      anchor="2026-10-22"
      isAdmin
      canViewMoney
      track="upstream"
    />
  ),
  wizard: (
    <NewTenderForm
      initialTrack="upstream"
      selectOptions={{
        area: ["Jawa"],
        customer: ["Customer"],
        entitas: ["ZKI"],
      }}
      catalogs={{ upstream: [], downstream: [] }}
      existingTenders={[]}
    />
  ),
  users: (
    <ManageUsersClient
      users={[
        user,
        { ...user, id: "viewer", name: "Test Viewer", role: "viewer" },
      ]}
      currentUserId="admin"
    />
  ),
  edit: (
    <EditTenderForm
      tender={
        {
          ...tenders[0],
          qty: 12.5,
          oe: 1000,
          nilaiPenawaran: 900,
          oeCatatan: null,
          catatanInternal: null,
        } as Tender
      }
      selectOptions={{
        area: ["Jawa"],
        customer: ["Customer"],
        entitas: ["ZKI"],
      }}
      milestoneTypes={[
        {
          id: "m1",
          key: "m1",
          label: "Site visit",
          track: "upstream",
          sortOrder: 1,
          showInTable: true,
        },
      ]}
      existingTenders={[]}
    />
  ),
  "edit-reorder": (
    <EditTenderForm
      tender={{ ...tenders[0], qty: 12.5, oe: 1000, nilaiPenawaran: 900, oeCatatan: null,
        catatanInternal: null, milestoneOrder: ["a", "b", "c"] } as Tender}
      selectOptions={{ area: ["Jawa"], customer: ["Customer"], entitas: ["ZKI"] }}
      milestoneTypes={["a", "b", "c"].map((key, i) => ({ id: key, key,
        label: `Stage ${key.toUpperCase()}`, track: "upstream" as const, sortOrder: i, showInTable: true }))}
      existingTenders={[]}
    />
  ),
  "milestones-reorder": (
    <MilestoneAdmin
      sections={[
        { track: "upstream", loadError: null, milestoneTypes: ["a", "b", "c"].map((id, i) => ({
          id, key: id, label: `Stage ${id.toUpperCase()}`, track: "upstream" as const,
          sortOrder: (i + 1) * 10, showInTable: true, archivedAt: null })) },
        { track: "downstream", loadError: null, milestoneTypes: [] },
      ]}
    />
  ),
  archive: <ArchiveAction tenderId="t" action="delete" />,
  deadlines: (
    <DeadlineWorkspace
      deadlines={[
        {
          tenderId: "t",
          days: 2,
          daysLabel: "D-2",
          customer: "Customer",
          product: "Package",
          milestoneLabel: "Site visit",
          dateFormatted: "24 Oct 2026",
          dateIso: "2026-10-24",
          milestoneKey: "m1",
          urgent: true,
          track: "upstream",
        },
      ]}
      followups={[]}
    />
  ),
  milestones: (
    <MilestoneAdmin
      sections={[
        { track: "upstream", loadError: null, milestoneTypes: [] },
        { track: "downstream", loadError: null, milestoneTypes: [] },
      ]}
    />
  ),
  login: <LoginForm next="/" />,
  number: <NumberDemo />,
  documents: (
    <DocumentExplorer
      tenderId="test"
      sections={[
        {
          id: "m1",
          title: "Site Visit",
          kind: "milestone",
          milestoneKey: "m1",
          documentTypeId: null,
          rootFiles: [],
          folders: [],
        },
      ]}
      isAdmin
    />
  ),
};
const name = (new URLSearchParams(location.search).get("component") ||
  "table") as keyof typeof components;
createRoot(document.getElementById("root")!).render(components[name]);
