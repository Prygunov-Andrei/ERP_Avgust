"use client";

import * as React from "react";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "@/components/ui/skeleton";
import { EstimateHeader } from "@/components/estimate/estimate-header";
import { SectionsPanel } from "@/components/estimate/sections-panel";
import { ItemsTable } from "@/components/estimate/items-table";
import { estimateApi } from "@/lib/api/client";
import { getWorkspaceId } from "@/lib/workspace";
import type { UUID } from "@/lib/api/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default function EstimateDetailPage({ params }: Props) {
  const { id } = use(params);
  const workspaceId = getWorkspaceId();
  const [sectionId, setSectionId] = React.useState<UUID | null>(null);

  const estimateQ = useQuery({
    queryKey: ["estimate", id, workspaceId],
    queryFn: () => estimateApi.get(id, workspaceId),
  });

  const sectionsQ = useQuery({
    queryKey: ["estimate-sections", id, workspaceId],
    queryFn: () => estimateApi.sections(id, workspaceId),
  });

  const itemsQ = useQuery({
    queryKey: ["estimate-items", id, workspaceId, sectionId],
    queryFn: () =>
      estimateApi.items(id, workspaceId, sectionId ?? undefined),
    enabled: sectionsQ.isSuccess,
  });

  if (estimateQ.isError) {
    return (
      <div className="container py-10">
        <h1 className="text-xl font-semibold text-destructive">
          Смета не найдена
        </h1>
        <p className="mt-2 text-muted-foreground">
          {estimateQ.error instanceof Error
            ? estimateQ.error.message
            : "Неизвестная ошибка"}
        </p>
      </div>
    );
  }

  if (!estimateQ.data) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const sections = sectionsQ.data ?? [];
  const firstSectionId = sections[0]?.id ?? null;

  return (
    <div className="flex h-full flex-col">
      <EstimateHeader estimate={estimateQ.data} />
      <div className="flex flex-1 overflow-hidden">
        <SectionsPanel
          estimateId={id}
          sections={sections}
          selectedId={sectionId}
          onSelect={setSectionId}
        />
        <ItemsTable
          estimateId={id}
          items={itemsQ.data ?? []}
          isLoading={itemsQ.isLoading || sectionsQ.isLoading}
          activeSectionId={sectionId}
          fallbackSectionId={firstSectionId}
        />
      </div>
    </div>
  );
}
