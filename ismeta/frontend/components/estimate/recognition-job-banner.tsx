"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, RotateCw, X, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { recognitionJobsApi } from "@/lib/api/client";
import { getWorkspaceId } from "@/lib/workspace";
import {
  formatDuration,
  formatRecognitionMeta,
} from "@/lib/recognition-jobs/format";
import type { RecognitionJob, UUID } from "@/lib/api/types";

interface Props {
  estimateId: UUID;
}

const POLL_ACTIVE_MS = 5_000;

const dismissedStorageKey = (estimateId: UUID) =>
  `ismeta:recognition-banner-dismissed:${estimateId}`;

function loadDismissed(estimateId: UUID): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(dismissedStorageKey(estimateId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((x) => typeof x === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(estimateId: UUID, ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      dismissedStorageKey(estimateId),
      JSON.stringify([...ids]),
    );
  } catch {
    // localStorage может быть отключён — не валим UI.
  }
}

// Жёлто-зелёно-красный alert над таблицей items: показывает прогресс активного
// recognition job либо последний завершённый успех/провал. Зелёный/красный —
// dismissable. Dismiss persistится в localStorage per-estimate, чтобы hard
// reload (Cmd+Shift+R) не возвращал уже скрытые failed-баннеры.
export function RecognitionJobBanner({ estimateId }: Props) {
  const workspaceId = getWorkspaceId();
  const qc = useQueryClient();

  const activeQ = useQuery({
    queryKey: ["recognition-jobs", "for-estimate", estimateId, "active"],
    queryFn: () =>
      recognitionJobsApi.list(workspaceId, {
        status: "queued,running",
        estimate_id: estimateId,
      }),
    refetchInterval: POLL_ACTIVE_MS,
    staleTime: 0,
  });

  const recentQ = useQuery({
    queryKey: ["recognition-jobs", "for-estimate", estimateId, "recent"],
    queryFn: () =>
      recognitionJobsApi.list(workspaceId, {
        status: "done,failed",
        estimate_id: estimateId,
      }),
    // recent обновляем реже — он нужен только когда нет active.
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const active = activeQ.data?.[0] ?? null;
  // Когда active job завершается, items_table инвалидируется — заодно
  // обновим recent, чтобы успех/ошибка показались в баннере.
  const prevActiveRef = React.useRef<RecognitionJob | null>(null);
  React.useEffect(() => {
    const prev = prevActiveRef.current;
    if (prev && !active) {
      // Active just disappeared — refresh recent.
      qc.invalidateQueries({
        queryKey: ["recognition-jobs", "for-estimate", estimateId, "recent"],
      });
      qc.invalidateQueries({ queryKey: ["estimate-items", estimateId] });
      qc.invalidateQueries({ queryKey: ["estimate-sections", estimateId] });
    }
    prevActiveRef.current = active;
  }, [active, qc, estimateId]);

  const recent = recentQ.data?.[0] ?? null;

  const [dismissed, setDismissed] = React.useState<Set<string>>(() =>
    loadDismissed(estimateId),
  );

  const cancelMutation = useMutation({
    mutationFn: (id: string) => recognitionJobsApi.cancel(id, workspaceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recognition-jobs"] });
      toast.success("Распознавание отменено");
    },
    onError: () => {
      toast.error("Не удалось отменить распознавание");
    },
  });

  const onCancel = (id: string) => {
    if (typeof window === "undefined") return;
    const ok = window.confirm(
      "Распознавание прервётся, плата за уже использованные токены сохраняется. Продолжить?",
    );
    if (ok) cancelMutation.mutate(id);
  };

  if (active) {
    return <ActiveBanner job={active} onCancel={onCancel} />;
  }

  if (recent && !dismissed.has(recent.id)) {
    return (
      <RecentBanner
        job={recent}
        onDismiss={() =>
          setDismissed((prev) => {
            const next = new Set(prev);
            next.add(recent.id);
            saveDismissed(estimateId, next);
            return next;
          })
        }
      />
    );
  }

  return null;
}

function ActiveBanner({
  job,
  onCancel,
}: {
  job: RecognitionJob;
  onCancel: (id: string) => void;
}) {
  const total = job.pages_total ?? 0;
  const done = job.pages_done ?? 0;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const queueing = job.status === "queued";

  return (
    <Alert variant="info" className="rounded-none border-x-0" data-testid="recognition-banner-active">
      <Loader2 className="animate-spin" />
      <AlertTitle className="flex items-center justify-between gap-2">
        <span>
          {queueing
            ? "Распознавание в очереди"
            : `Распознавание: ${done} из ${total || "?"} ${pluralPagesShort(total)}`}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-muted-foreground hover:text-destructive"
          onClick={() => onCancel(job.id)}
          data-testid="recognition-banner-cancel"
        >
          Отменить
        </Button>
      </AlertTitle>
      <AlertDescription>
        <div className="text-xs text-muted-foreground">
          {job.file_name}
          {job.items_count > 0 && ` · уже распознано ${job.items_count} позиций`}
        </div>
        {!queueing && (
          <Progress
            value={pct}
            className="mt-2 h-1.5 bg-sky-200/70 [&>div]:bg-sky-600"
          />
        )}
      </AlertDescription>
    </Alert>
  );
}

function RecentBanner({
  job,
  onDismiss,
}: {
  job: RecognitionJob;
  onDismiss: () => void;
}) {
  const meta = formatRecognitionMeta(job);

  if (job.status === "done") {
    return (
      <Alert
        variant="success"
        className="rounded-none border-x-0"
        data-testid="recognition-banner-done"
      >
        <CheckCircle2 />
        <AlertTitle className="flex items-center justify-between gap-2">
          <span>
            Распознано {job.items_count} позиций за{" "}
            {formatDuration(job.duration_seconds)}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="-mr-2 h-7 w-7 p-0 text-muted-foreground"
            onClick={onDismiss}
            aria-label="Скрыть"
          >
            <X className="h-4 w-4" />
          </Button>
        </AlertTitle>
        {meta && (
          <AlertDescription>
            <div className="text-xs text-muted-foreground">
              {meta.model} · {meta.cost} · {meta.duration}
            </div>
          </AlertDescription>
        )}
      </Alert>
    );
  }

  if (job.status === "failed") {
    return (
      <Alert
        variant="destructive"
        className="rounded-none border-x-0"
        data-testid="recognition-banner-failed"
      >
        <XCircle />
        <AlertTitle className="flex items-center justify-between gap-2">
          <span>Ошибка распознавания</span>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={onDismiss}
              data-testid="recognition-banner-retry"
            >
              <RotateCw className="h-3 w-3" />
              Скрыть
            </Button>
          </div>
        </AlertTitle>
        <AlertDescription>
          <div className="text-xs">
            {job.error_message || "Распознавание не удалось"}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

function pluralPagesShort(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "страницы";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "страниц";
  return "страниц";
}
