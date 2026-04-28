"use client";

import { useQuery } from "@tanstack/react-query";

import { recognitionJobsApi } from "@/lib/api/client";
import { getWorkspaceId } from "@/lib/workspace";
import { formatRecognitionMeta } from "@/lib/recognition-jobs/format";
import type { UUID } from "@/lib/api/types";

interface Props {
  estimateId: UUID;
}

// Мелкая серая строка-подвал «Распознано: <модель> · <цена> · <дата>».
// Источник — последний done-job для этой сметы. Если нет ни одного done или
// llm_costs пустой placeholder (E19-1 без E18) — компонент возвращает null,
// чтобы не показывать «— · — · —».
export function RecognitionMetaLine({ estimateId }: Props) {
  const workspaceId = getWorkspaceId();
  const { data } = useQuery({
    queryKey: ["recognition-jobs", "for-estimate", estimateId, "last-done"],
    queryFn: () =>
      recognitionJobsApi.list(workspaceId, {
        status: "done",
        estimate_id: estimateId,
      }),
  });

  const lastJob = data?.[0];
  if (!lastJob) return null;

  const meta = formatRecognitionMeta(lastJob);
  // Без llm_costs (placeholder E19-1) — показываем хотя бы дату завершения.
  const dateLabel = formatShortDate(lastJob.completed_at);

  if (!meta && !dateLabel) return null;

  const parts: string[] = [];
  if (meta) parts.push(meta.model, meta.cost, meta.duration);
  if (dateLabel) parts.push(dateLabel);

  return (
    <div
      className="text-xs text-muted-foreground"
      data-testid="recognition-meta-line"
    >
      Распознано: {parts.join(" · ")}
    </div>
  );
}

function formatShortDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // ru: «26 апр» — без года, всё равно «forever» хранится; год можно посмотреть
  // в попапе jobs panel (там полная дата).
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
