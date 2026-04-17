"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type EquipmentTrack = "all" | "standard" | "key";

export const EQUIPMENT_TRACK_LABELS: Record<EquipmentTrack, string> = {
  all: "Все",
  standard: "Стандарт",
  key: "Основное оборудование",
};

interface Props {
  value: EquipmentTrack;
  onChange: (next: EquipmentTrack) => void;
  counts: Record<EquipmentTrack, number>;
}

const ORDER: EquipmentTrack[] = ["all", "standard", "key"];

export function TrackTabs({ value, onChange, counts }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Трек оборудования"
      className="inline-flex items-center gap-1 rounded-md border bg-muted/30 p-1"
    >
      {ORDER.map((track) => {
        const active = value === track;
        return (
          <button
            key={track}
            type="button"
            role="tab"
            aria-selected={active}
            data-track={track}
            onClick={() => onChange(track)}
            className={cn(
              "inline-flex items-center gap-2 rounded px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span>{EQUIPMENT_TRACK_LABELS[track]}</span>
            <Badge
              variant={active ? "secondary" : "outline"}
              className="tabular-nums"
            >
              {counts[track]}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}
