"use client";

import * as React from "react";
import { toast } from "sonner";

import type { RecognitionJob } from "@/lib/api/types";

import { formatRecognitionMeta } from "./format";

interface ShowOptions {
  // Перейти в смету (Next.js router.push). Если не передан — без action.
  goToEstimate?: (estimateId: string) => void;
  // Повторить запуск (создать новый job из файла). Опционально.
  onRetry?: (job: RecognitionJob) => void;
}

function MetaLine({ job }: { job: RecognitionJob }) {
  const meta = formatRecognitionMeta(job);
  if (!meta) return null;
  return (
    <div className="mt-1 text-xs text-muted-foreground">
      {meta.model} · {meta.cost} · {meta.duration}
    </div>
  );
}

export function showRecognitionToast(
  job: RecognitionJob,
  options: ShowOptions = {},
): void {
  const { goToEstimate, onRetry } = options;
  const action = goToEstimate
    ? {
        label: "Открыть смету",
        onClick: () => goToEstimate(job.estimate_id),
      }
    : undefined;

  if (job.status === "done") {
    toast.success(`✓ ${job.estimate_name}`, {
      description: (
        <div>
          <div>{job.items_count} позиций распознано</div>
          <MetaLine job={job} />
        </div>
      ),
      duration: 10_000,
      action,
    });
    return;
  }

  if (job.status === "failed") {
    const detail = job.error_message || "распознавание не удалось";
    toast.error(`✗ ${job.estimate_name}`, {
      description: <div>Ошибка: {detail}</div>,
      duration: 15_000,
      action: onRetry
        ? { label: "Повторить", onClick: () => onRetry(job) }
        : action,
    });
    return;
  }

  if (job.status === "cancelled") {
    toast(`⊘ ${job.estimate_name}`, {
      description: "Распознавание отменено",
      duration: 6_000,
      action,
    });
    return;
  }
}
