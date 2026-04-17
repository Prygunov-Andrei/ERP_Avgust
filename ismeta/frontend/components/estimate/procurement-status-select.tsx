"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProcurementStatusBadge } from "./procurement-status-badge";
import { cn } from "@/lib/utils";
import {
  PROCUREMENT_STATUSES,
  PROCUREMENT_STATUS_LABELS,
  type ProcurementStatus,
} from "@/lib/api/types";

interface Props {
  value: ProcurementStatus;
  onChange: (next: ProcurementStatus) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

export function ProcurementStatusSelect({
  value,
  onChange,
  disabled,
  ariaLabel = "Статус закупки",
}: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-1 py-0.5 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          !disabled && "hover:opacity-80",
          disabled && "opacity-60 cursor-not-allowed",
        )}
      >
        <ProcurementStatusBadge status={value} />
        <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[10rem]">
        {PROCUREMENT_STATUSES.map((status) => (
          <DropdownMenuItem
            key={status}
            onSelect={() => {
              if (status !== value) onChange(status);
            }}
            data-status={status}
            aria-selected={status === value}
          >
            <Check
              className={cn(
                "h-3.5 w-3.5",
                status === value ? "opacity-100" : "opacity-0",
              )}
            />
            <span>{PROCUREMENT_STATUS_LABELS[status]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
