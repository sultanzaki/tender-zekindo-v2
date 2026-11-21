import { Badge } from "@/components/ui/badge";
import { resultTone } from "@/lib/tender-logic";
import shared from "./shared.module.css";

const TONE_CLASS = {
  success: shared.badgeSuccess,
  running: shared.badgeRunning,
  error: shared.badgeError,
  neutral: shared.badgeNeutral,
};

export function ResultBadge({ result }: { result: string | null }) {
  const tone = resultTone(result);
  return (
    <Badge variant="outline" className={`${shared.badge} ${TONE_CLASS[tone]}`}>
      {result || "Running"}
    </Badge>
  );
}
