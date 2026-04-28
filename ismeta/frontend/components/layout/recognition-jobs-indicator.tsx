"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  CircleSlash,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";

import { useRecognitionJobs } from "@/contexts/recognition-jobs-context";
import { recognitionJobsApi } from "@/lib/api/client";
import { getWorkspaceId } from "@/lib/workspace";
import {
  formatDuration,
  formatRecognitionMeta,
} from "@/lib/recognition-jobs/format";
import { cn } from "@/lib/utils";
import type { RecognitionJob } from "@/lib/api/types";

export function RecognitionJobsIndicator() {
  const { active, recent, unreadCount, markAllRead } = useRecognitionJobs();
  const [open, setOpen] = React.useState(false);

  const totalCount = active.length + unreadCount;

  // При открытии popover'а помечаем все непрочитанные как прочитанные.
  React.useEffect(() => {
    if (open && unreadCount > 0) markAllRead();
  }, [open, unreadCount, markAllRead]);

  const hasContent = active.length > 0 || recent.length > 0;
  const Icon = active.length > 0 ? Loader2 : CheckCircle2;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Распознавание PDF"
          data-testid="recognition-jobs-trigger"
        >
          <Icon
            className={cn(
              "h-5 w-5",
              active.length > 0
                ? "animate-spin text-primary"
                : unreadCount > 0
                  ? "text-emerald-600"
                  : "text-muted-foreground",
            )}
          />
          {totalCount > 0 && (
            <Badge
              variant={active.length > 0 ? "default" : "success"}
              className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[10px] leading-none"
              data-testid="recognition-jobs-badge"
            >
              {totalCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" data-testid="recognition-jobs-popover">
        <div className="border-b px-4 py-3">
          <div className="text-sm font-semibold">Распознавание PDF</div>
          <div className="text-xs text-muted-foreground">
            {active.length > 0
              ? `${active.length} в работе`
              : recent.length > 0
                ? "Завершено сегодня"
                : "Нет активных задач"}
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {!hasContent && (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              Когда вы запустите импорт PDF, прогресс появится здесь.
            </div>
          )}

          {active.length > 0 && (
            <Section title="В работе">
              {active.map((job) => (
                <ActiveJobRow
                  key={job.id}
                  job={job}
                  onClose={() => setOpen(false)}
                />
              ))}
            </Section>
          )}

          {recent.length > 0 && (
            <Section title="Завершено сегодня">
              {recent.map((job) => (
                <RecentJobRow
                  key={job.id}
                  job={job}
                  onClose={() => setOpen(false)}
                />
              ))}
            </Section>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-1">
      <div className="px-4 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="divide-y">{children}</div>
    </div>
  );
}

function ProgressLine({ job }: { job: RecognitionJob }) {
  const total = job.pages_total ?? 0;
  const done = job.pages_done ?? 0;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const labelTotal = job.pages_total ?? "?";

  if (job.status === "queued") {
    return (
      <div className="text-xs text-muted-foreground">
        В очереди — ожидает свободного слота
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Progress value={pct} className="h-1.5" />
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {done} из {labelTotal} {pluralPages(total || 0)}
        </span>
        {job.items_count > 0 && <span>{job.items_count} позиций</span>}
      </div>
    </div>
  );
}

function ActiveJobRow({
  job,
  onClose,
}: {
  job: RecognitionJob;
  onClose: () => void;
}) {
  const workspaceId = getWorkspaceId();
  const qc = useQueryClient();

  const cancelMutation = useMutation({
    mutationFn: () => recognitionJobsApi.cancel(job.id, workspaceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recognition-jobs"] });
      toast.success("Распознавание отменено");
    },
    onError: () => {
      toast.error("Не удалось отменить распознавание");
    },
  });

  const handleCancel = () => {
    if (typeof window === "undefined") return;
    const ok = window.confirm(
      "Распознавание прервётся, плата за уже использованные токены сохраняется. Продолжить?",
    );
    if (ok) cancelMutation.mutate();
  };

  return (
    <div className="px-4 py-3" data-testid="recognition-job-active">
      <div className="text-sm font-medium leading-snug">{job.estimate_name}</div>
      <div className="mt-0.5 truncate text-xs text-muted-foreground">
        {job.file_name}
      </div>
      <div className="mt-2">
        <ProgressLine job={job} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={onClose}
        >
          <Link href={`/estimates/${job.estimate_id}`}>Открыть</Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-muted-foreground hover:text-destructive"
          disabled={cancelMutation.isPending}
          onClick={handleCancel}
          data-testid="recognition-job-cancel"
        >
          Отменить
        </Button>
      </div>
    </div>
  );
}

function RecentJobRow({
  job,
  onClose,
}: {
  job: RecognitionJob;
  onClose: () => void;
}) {
  const meta = formatRecognitionMeta(job);
  const StatusIcon =
    job.status === "done"
      ? CheckCircle2
      : job.status === "failed"
        ? XCircle
        : CircleSlash;
  const statusColor =
    job.status === "done"
      ? "text-emerald-600"
      : job.status === "failed"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <Link
      href={`/estimates/${job.estimate_id}`}
      onClick={onClose}
      className="block px-4 py-2.5 transition-colors hover:bg-accent/50"
      data-testid="recognition-job-recent"
    >
      <div className="flex items-start gap-2">
        <StatusIcon className={cn("mt-0.5 h-4 w-4 shrink-0", statusColor)} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {job.estimate_name}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {job.status === "done" && (
              <>
                <span>{job.items_count} позиций</span>
                <span>·</span>
                <span>{formatDuration(job.duration_seconds)}</span>
              </>
            )}
            {job.status === "failed" && (
              <span className="truncate">
                {job.error_message || "ошибка распознавания"}
              </span>
            )}
            {job.status === "cancelled" && <span>отменено</span>}
          </div>
          {meta && (
            <div className="mt-0.5 text-[11px] text-muted-foreground/80">
              {meta.model} · {meta.cost} · {meta.duration}
            </div>
          )}
        </div>
        {job.status === "failed" && (
          <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
        )}
      </div>
    </Link>
  );
}

function pluralPages(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "страницы";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "страниц";
  return "страниц";
}
