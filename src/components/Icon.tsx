import {
  Archive,
  ArrowRight,
  Bell,
  FolderOpen,
  Settings2,
  ShieldCheck,
  ChartColumn,
  CircleUserRound,
  Download,
  LayoutDashboard,
  ListChecks,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
  X,
  type LucideProps,
} from "lucide-react";

const icons = {
  archive: Archive,
  arrow: ArrowRight,
  notifications: Bell,
  tenders: FolderOpen,
  analytics: ChartColumn,
  account: CircleUserRound,
  download: Download,
  overview: LayoutDashboard,
  milestones: ListChecks,
  plus: Plus,
  search: Search,
  filters: SlidersHorizontal,
  settings: Settings2,
  shield: ShieldCheck,
  users: Users,
  close: X,
};
export function Icon({
  name,
  ...props
}: LucideProps & { name: keyof typeof icons }) {
  const Glyph = icons[name];
  return <Glyph size={18} strokeWidth={1.7} aria-hidden="true" {...props} />;
}
