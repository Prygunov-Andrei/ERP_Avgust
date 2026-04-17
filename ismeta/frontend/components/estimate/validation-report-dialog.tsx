"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { agentApi, ApiError } from "@/lib/api/client";
import { getWorkspaceId } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import type {
  IssueSeverity,
  UUID,
  ValidationIssue,
  ValidationReport,
} from "@/lib/api/types";

interface Props {
  estimateId: UUID;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectItem?: (itemId: UUID) => void;
}

const SEVERITY_META: Record<
  IssueSeverity,
  {
    label: string;
    icon: typeof AlertCircle;
    className: string;
  }
> = {
  error: {
    label: "Ошибка",
    icon: AlertCircle,
    className:
      "text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:text-rose-200 dark:border-rose-900/60",
  },
  warning: {
    label: "Внимание",
    icon: AlertTriangle,
    className:
      "text-amber-800 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900/60",
  },
  info: {
    label: "Инфо",
    icon: Info,
    className:
      "text-sky-800 bg-sky-50 border-sky-200 dark:bg-sky-950/30 dark:text-sky-200 dark:border-sky-900/60",
  },
};

export function ValidationReportDialog({
  estimateId,
  open,
  onOpenChange,
  onSelectItem,
}: Props) {
  const workspaceId = getWorkspaceId();
  const [report, setReport] = React.useState<ValidationReport | null>(null);

  const runValidate = useMutation({
    mutationFn: () => agentApi.validate(estimateId, workspaceId),
    onSuccess: (data) => setReport(data),
    onError: (e: unknown) => {
      if (e instanceof ApiError) {
        toast.error(e.problem?.detail ?? "Валидация не удалась");
      } else {
        toast.error("Валидация не удалась");
      }
    },
  });

  React.useEffect(() => {
    if (open && !report && !runValidate.isPending) {
      runValidate.mutate();
    }
    if (!open) {
      // При закрытии сбрасываем, чтобы повторное открытие запускало проверку заново
      setReport(null);
      runValidate.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Проверка сметы ИИ</DialogTitle>
          <DialogDescription>
            {runValidate.isPending
              ? "Анализ сметы…"
              : report
                ? report.issues.length > 0
                  ? `Найдено ${report.issues.length} ${pluralize(report.issues.length)}`
                  : "Ошибок и замечаний не найдено"
                : "Запуск проверки…"}
          </DialogDescription>
        </DialogHeader>

        {runValidate.isPending ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Проверяю смету с помощью ИИ…
          </div>
        ) : report ? (
          <IssuesList
            issues={report.issues}
            onSelectItem={(id) => {
              onSelectItem?.(id);
              onOpenChange(false);
            }}
          />
        ) : null}

        {report ? (
          <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
            <span data-testid="val-tokens">
              Токенов: {report.tokens_used.toLocaleString("ru-RU")}
            </span>
            <span data-testid="val-cost">
              Стоимость: ${report.cost_usd.toFixed(4)}
            </span>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IssuesList({
  issues,
  onSelectItem,
}: {
  issues: ValidationIssue[];
  onSelectItem: (id: UUID) => void;
}) {
  if (issues.length === 0) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
        Всё ок — ИИ не нашёл проблем.
      </div>
    );
  }

  return (
    <ul className="max-h-[50vh] space-y-2 overflow-auto pr-1">
      {issues.map((issue, idx) => {
        const meta = SEVERITY_META[issue.severity] ?? SEVERITY_META.info;
        const Icon = meta.icon;
        const clickable = Boolean(issue.item_id);
        const props = clickable
          ? {
              role: "button" as const,
              tabIndex: 0,
              onClick: () => onSelectItem(issue.item_id!),
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectItem(issue.item_id!);
                }
              },
            }
          : {};
        return (
          <li
            key={idx}
            data-severity={issue.severity}
            data-item-id={issue.item_id ?? ""}
            className={cn(
              "flex items-start gap-2 rounded-md border p-3 text-sm",
              meta.className,
              clickable && "cursor-pointer hover:opacity-90",
            )}
            {...props}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="font-medium">
                {issue.item_name || meta.label}
              </div>
              <div className="mt-0.5">{issue.message}</div>
              {issue.suggestion ? (
                <div className="mt-1 text-xs opacity-80">
                  → {issue.suggestion}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function pluralize(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "проблема";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "проблемы";
  return "проблем";
}
