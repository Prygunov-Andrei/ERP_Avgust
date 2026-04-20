"use client";

import { AlertTriangle, Plus, RefreshCw } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { PreviewRow, PreviewSummary } from "@/lib/excel/preview";

interface Props {
  rows: PreviewRow[];
  summary: PreviewSummary;
}

export function PreviewTable({ rows, summary }: Props) {
  if (rows.length === 0) {
    return (
      <div
        className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground"
        data-testid="preview-empty"
      >
        Файл не содержит позиций для импорта.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex flex-wrap items-center gap-3 text-xs"
        data-testid="preview-summary"
      >
        <SummaryBadge
          data-testid="summary-create"
          variant="create"
          label={`Создать: ${summary.create}`}
        />
        <SummaryBadge
          data-testid="summary-update"
          variant="update"
          label={`Обновить: ${summary.update}`}
        />
        {summary.sections > 0 ? (
          <SummaryBadge
            data-testid="summary-sections"
            variant="section"
            label={`Разделов: ${summary.sections}`}
          />
        ) : null}
        {summary.errors > 0 ? (
          <SummaryBadge
            data-testid="summary-errors"
            variant="error"
            label={`Ошибок: ${summary.errors}`}
          />
        ) : null}
      </div>

      <div
        className="max-h-80 overflow-auto rounded-md border"
        data-testid="preview-table-wrapper"
      >
        <Table>
          <TableHeader className="sticky top-0 bg-background">
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Наименование</TableHead>
              <TableHead className="w-20">Ед.изм.</TableHead>
              <TableHead className="w-24 text-right">Кол-во</TableHead>
              <TableHead className="w-28">Действие</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <PreviewRowCells key={i} row={row} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function PreviewRowCells({ row }: { row: PreviewRow }) {
  if (row.kind === "section") {
    return (
      <TableRow data-row-kind="section" className="bg-muted/40">
        <TableCell className="text-xs text-muted-foreground">
          {row.rowIdx}
        </TableCell>
        <TableCell colSpan={4} className="font-semibold">
          Раздел: {row.name}
        </TableCell>
      </TableRow>
    );
  }
  if (row.kind === "error") {
    return (
      <TableRow
        data-row-kind="error"
        className="bg-rose-50 text-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
      >
        <TableCell className="text-xs">{row.rowIdx}</TableCell>
        <TableCell colSpan={3} className="text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{row.name || "(пусто)"}</span>
            <span className="text-xs opacity-80">— {row.message}</span>
          </div>
        </TableCell>
        <TableCell className="text-xs">Ошибка</TableCell>
      </TableRow>
    );
  }
  return (
    <TableRow
      data-row-kind="item"
      data-action={row.action}
      className={cn(
        row.action === "create"
          ? "bg-emerald-50 dark:bg-emerald-950/30"
          : "bg-amber-50 dark:bg-amber-950/30",
      )}
    >
      <TableCell className="text-xs text-muted-foreground tabular-nums">
        {row.rowIdx}
      </TableCell>
      <TableCell className="font-medium">{row.name}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {row.unit}
      </TableCell>
      <TableCell className="text-right tabular-nums">{row.quantity}</TableCell>
      <TableCell className="text-xs">
        {row.action === "create" ? (
          <span className="inline-flex items-center gap-1 text-emerald-800 dark:text-emerald-200">
            <Plus className="h-3 w-3" aria-hidden />
            Создать
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-amber-800 dark:text-amber-200">
            <RefreshCw className="h-3 w-3" aria-hidden />
            Обновить
          </span>
        )}
      </TableCell>
    </TableRow>
  );
}

const BADGE_CLASS: Record<
  "create" | "update" | "section" | "error",
  string
> = {
  create:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  update: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  section:
    "bg-muted text-muted-foreground",
  error: "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200",
};

function SummaryBadge({
  variant,
  label,
  ...rest
}: {
  variant: keyof typeof BADGE_CLASS;
  label: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 font-medium",
        BADGE_CLASS[variant],
      )}
      {...rest}
    >
      {label}
    </span>
  );
}
