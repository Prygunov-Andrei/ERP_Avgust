import { Badge } from "@/components/ui/badge";
import type { MatchSource } from "@/lib/api/types";

export type ConfidenceLevel = "high" | "medium" | "low" | "none";

export function getConfidenceLevel(
  confidence: number,
  source: MatchSource,
): ConfidenceLevel {
  if (source === "unmatched" || confidence <= 0) return "none";
  if (confidence >= 0.9) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

const CONFIG: Record<
  ConfidenceLevel,
  { label: string; variant: "success" | "warning" | "destructive" | "secondary" }
> = {
  high: { label: "Уверенно", variant: "success" },
  medium: { label: "Проверить", variant: "warning" },
  low: { label: "Сомнительно", variant: "destructive" },
  none: { label: "Не найдено", variant: "secondary" },
};

interface Props {
  confidence: number;
  source: MatchSource;
  showValue?: boolean;
}

export function ConfidenceBadge({ confidence, source, showValue = true }: Props) {
  const level = getConfidenceLevel(confidence, source);
  const { label, variant } = CONFIG[level];
  return (
    <Badge variant={variant} data-level={level}>
      {label}
      {showValue && level !== "none" ? (
        <span className="ml-1 tabular-nums opacity-80">
          {confidence.toFixed(2)}
        </span>
      ) : null}
    </Badge>
  );
}
