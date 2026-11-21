import {
  Archive,
  ArrowRight,
  Bell,
  CalendarDays,
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
  tenders: CalendarDays,
  analytics: ChartColumn,
  account: CircleUserRound,
  download: Download,
  overview: LayoutDashboard,
  milestones: ListChecks,
  plus: Plus,
  search: Search,
  filters: SlidersHorizontal,
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
