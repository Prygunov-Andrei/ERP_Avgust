"use client";

import * as React from "react";
import { use } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { MatchingReview } from "@/components/estimate/matching-review";
import { getWorkspaceId } from "@/lib/workspace";
import type { MatchingSession } from "@/lib/api/types";

interface Props {
  params: Promise<{ id: string; sessionId: string }>;
}

export default function MatchingReviewPage({ params }: Props) {
  const { id, sessionId } = use(params);
  const workspaceId = getWorkspaceId();
  const qc = useQueryClient();

  const session = qc.getQueryData<MatchingSession>([
    "matching",
    id,
    sessionId,
    workspaceId,
  ]);

  if (!session) {
    return (
      <div className="container py-10">
        <h1 className="text-xl font-semibold">Результаты подбора недоступны</h1>
        <p className="mt-2 text-muted-foreground">
          Сессия{" "}
          <code className="font-mono text-sm">{sessionId}</code> не найдена в
          локальном кеше. Backend E5.1 не хранит сессии — запустите подбор
          заново со страницы сметы.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href={`/estimates/${id}`}>← К смете</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b bg-background px-6 py-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/estimates/${id}`}>← К смете</Link>
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">
          Подбор работ — ревью результатов
        </h1>
      </div>
      <MatchingReview estimateId={id} sessionId={sessionId} session={session} />
    </div>
  );
}
