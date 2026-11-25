// The design prototype originally loaded the company's real tender register
// here. That data was removed from the repository because it is confidential;
// the prototype now renders two fictional rows.
export const TENDERS = [
  { id: "T0001", period: "2026", area: "Jawa", tenderNo: "DEMO-001", customer: "Contoh Energi Tbk", product: "Demulsifier Supply (sample)", entitas: "ZKI", qty: 1000, oe: 1000000, idrPerL: 1000, milestones: { regist: "2026-01-05" }, result: null, carryOver: null, remarks: "Fictional sample", nilaiPenawaran: null },
  { id: "T0002", period: "2026", area: "Sumatera", tenderNo: "DEMO-002", customer: "Sampel Migas", product: "Scale Inhibitor (sample)", entitas: "TKT", qty: null, oe: null, idrPerL: null, milestones: { regist: "2026-02-10" }, result: "WIN", carryOver: null, remarks: null, nilaiPenawaran: null },
];
