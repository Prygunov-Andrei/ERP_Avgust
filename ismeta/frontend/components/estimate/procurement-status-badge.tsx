import { cn } from "@/lib/utils";
import {
  PROCUREMENT_STATUS_LABELS,
  type ProcurementStatus,
} from "@/lib/api/types";

const COLOR_CLASS: Record<ProcurementStatus, string> = {
  none: "bg-muted text-muted-foreground",
  requested:
    "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
  quoted:
    "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  booked:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  ordered:
    "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-200",
};

interface Props {
  status: ProcurementStatus;
  className?: string;
}

export function ProcurementStatusBadge({ status, className }: Props) {
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold",
        COLOR_CLASS[status],
        className,
      )}
    >
      {PROCUREMENT_STATUS_LABELS[status]}
    </span>
  );
}
