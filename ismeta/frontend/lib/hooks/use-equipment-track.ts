"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { EquipmentTrack } from "@/components/estimate/track-tabs";

const VALID: readonly EquipmentTrack[] = ["all", "standard", "key"] as const;

function parse(v: string | null): EquipmentTrack {
  return (VALID as readonly string[]).includes(v ?? "")
    ? (v as EquipmentTrack)
    : "all";
}

export function useEquipmentTrack(): [EquipmentTrack, (next: EquipmentTrack) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const current = parse(searchParams.get("track"));

  const setTrack = React.useCallback(
    (next: EquipmentTrack) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "all") params.delete("track");
      else params.set("track", next);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [searchParams, router, pathname],
  );

  return [current, setTrack];
}
