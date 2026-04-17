"use client";

import { ProcurementStatusBadge } from "./procurement-status-badge";
import { cn } from "@/lib/utils";
import {
  PROCUREMENT_STATUSES,
  PROCUREMENT_STATUS_LABELS,
  type EstimateItem,
  type ProcurementStatus,
} from "@/lib/api/types";

interface Props {
  items: EstimateItem[];
  className?: string;
}

type Counts = Record<ProcurementStatus, number>;

const ORDER: ProcurementStatus[] = [
  "requested",
  "quoted",
  "booked",
  "ordered",
];

export function ProcurementSummary({ items, className }: Props) {
  const keyItems = items.filter((i) => i.is_key_equipment);

  const counts = PROCUREMENT_STATUSES.reduce<Counts>(
    (acc, s) => {
      acc[s] = 0;
      return acc;
    },
    {} as Counts,
  );
  for (const it of keyItems) counts[it.procurement_status]++;

  const pendingAction = counts.none + counts.requested;

  if (keyItems.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-md border bg-card p-3 text-sm",
        className,
      )}
      aria-label="Сводка по закупкам основного оборудования"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">Основное оборудование</span>
        <span
          className="tabular-nums text-muted-foreground"
          data-testid="proc-total"
        >
          {keyItems.length}{" "}
          {keyItems.length === 1 ? "позиция" : "позиций"}
        </span>
      </div>

      <ul className="space-y-1">
        {ORDER.map((status) => (
          <li
            key={status}
            className="flex items-center justify-between gap-2"
            data-status={status}
          >
            <ProcurementStatusBadge status={status} />
            <span className="tabular-nums text-muted-foreground">
              {counts[status]}
            </span>
          </li>
        ))}
      </ul>

      <div
        className="mt-3 flex items-center justify-between border-t pt-2 text-sm font-medium"
        data-testid="proc-pending"
      >
        <span>Ожидают действия</span>
        <span
          className={cn(
            "tabular-nums",
            pendingAction > 0 ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground",
          )}
        >
          {pendingAction}
        </span>
      </div>

      <p className="sr-only">
        Статусы: {ORDER.map((s) => `${PROCUREMENT_STATUS_LABELS[s]}=${counts[s]}`).join(", ")}
      </p>
    </div>
  );
}
