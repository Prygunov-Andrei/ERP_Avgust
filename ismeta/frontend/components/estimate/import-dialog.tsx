"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Upload,
} from "lucide-react";
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
import { ApiError, importApi } from "@/lib/api/client";
import { getWorkspaceId } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import type { ImportResult, UUID } from "@/lib/api/types";

interface Props {
  estimateId: UUID;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACCEPT = ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function isXlsx(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith(".xlsx") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

export function ImportDialog({ estimateId, open, onOpenChange }: Props) {
  const workspaceId = getWorkspaceId();
  const qc = useQueryClient();
  const [file, setFile] = React.useState<File | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const upload = useMutation({
    mutationFn: (f: File) => importApi.uploadExcel(estimateId, f, workspaceId),
    onSuccess: (data) => {
      setResult(data);
      qc.invalidateQueries({ queryKey: ["estimate-items", estimateId] });
      qc.invalidateQueries({ queryKey: ["estimate", estimateId] });
      if (data.created + data.updated > 0) {
        toast.success(
          `Импорт: +${data.created} новых, ~${data.updated} обновлено`,
        );
      }
    },
    onError: (e: unknown) => {
      // Backend возвращает 400 с {created:0, updated:0, errors:[...]}
      // когда все строки не прошли — показываем как результат, а не как фейл.
      if (
        e instanceof ApiError &&
        e.problem &&
        typeof e.problem === "object" &&
        Array.isArray((e.problem as { errors?: unknown }).errors)
      ) {
        const p = e.problem as unknown as ImportResult;
        setResult({
          created: p.created ?? 0,
          updated: p.updated ?? 0,
          errors: p.errors,
        });
        return;
      }
      if (e instanceof ApiError) {
        toast.error(e.problem?.detail ?? "Не удалось импортировать файл");
      } else {
        toast.error("Не удалось импортировать файл");
      }
    },
  });

  const reset = React.useCallback(() => {
    setFile(null);
    setResult(null);
    upload.reset();
    if (inputRef.current) inputRef.current.value = "";
  }, [upload]);

  React.useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const first = files[0]!;
    if (!isXlsx(first)) {
      toast.error("Нужен файл .xlsx");
      return;
    }
    setFile(first);
  };

  const submit = () => {
    if (!file) return;
    upload.mutate(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="import-dialog">
        <DialogHeader>
          <DialogTitle>
            {result ? "Результат импорта" : "Импорт Excel"}
          </DialogTitle>
          <DialogDescription>
            {result
              ? "Изменения применены к смете."
              : "Загрузите .xlsx файл с позициями сметы."}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <ResultView result={result} />
        ) : (
          <div className="flex flex-col gap-3">
            <DropZone
              file={file}
              isDragging={isDragging}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFiles(e.dataTransfer.files);
              }}
              onClick={() => inputRef.current?.click()}
            />
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              aria-label="Выбрать .xlsx файл"
              onChange={(e) => handleFiles(e.target.files)}
              className="sr-only"
            />
            <FormatHint />
          </div>
        )}

        <DialogFooter>
          {result ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  reset();
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Импортировать ещё
              </Button>
              <Button onClick={() => onOpenChange(false)}>Закрыть</Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={upload.isPending}
              >
                Отмена
              </Button>
              <Button
                onClick={submit}
                disabled={!file || upload.isPending}
                data-testid="import-submit"
              >
                {upload.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Загрузить
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DropZone({
  file,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
}: {
  file: File | null;
  isDragging: boolean;
  onDragOver: React.DragEventHandler;
  onDragLeave: React.DragEventHandler;
  onDrop: React.DragEventHandler;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      data-testid="import-dropzone"
      data-dragging={isDragging || undefined}
      className={cn(
        "flex min-h-[140px] w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 bg-muted/20 hover:border-muted-foreground/50",
      )}
    >
      <FileSpreadsheet
        className={cn(
          "h-8 w-8",
          file ? "text-primary" : "text-muted-foreground",
        )}
        aria-hidden
      />
      {file ? (
        <>
          <span className="font-medium">{file.name}</span>
          <span className="text-xs text-muted-foreground">
            {Math.round(file.size / 1024)} КБ — нажмите «Загрузить»
          </span>
        </>
      ) : (
        <>
          <span className="font-medium">
            Перетащите .xlsx файл сюда
          </span>
          <span className="text-xs text-muted-foreground">
            или нажмите, чтобы выбрать
          </span>
        </>
      )}
    </button>
  );
}

function FormatHint() {
  return (
    <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
      <div className="font-medium text-foreground">Формат листа</div>
      <div className="mt-1">
        Наименование · Ед.изм. · Кол-во · Цена оборуд. · Цена мат. · Цена
        работ
      </div>
      <div className="mt-1">
        <strong>Жирная строка</strong> = название раздела. Строки с row_id
        обновляются, без row_id — создаются.
      </div>
    </div>
  );
}

function ResultView({ result }: { result: ImportResult }) {
  const hasChanges = result.created + result.updated > 0;
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center gap-2" data-testid="result-created">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
        <span>Создано:</span>
        <span className="font-medium tabular-nums">{result.created}</span>
      </div>
      <div className="flex items-center gap-2" data-testid="result-updated">
        <RefreshCw className="h-4 w-4 text-sky-600" aria-hidden />
        <span>Обновлено:</span>
        <span className="font-medium tabular-nums">{result.updated}</span>
      </div>
      {result.errors.length > 0 ? (
        <div className="flex flex-col gap-2" data-testid="result-errors">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            <span>Ошибки: {result.errors.length}</span>
          </div>
          <ul className="max-h-40 list-disc space-y-1 overflow-auto rounded-md border bg-muted/20 p-3 pl-6 text-xs">
            {result.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {!hasChanges && result.errors.length === 0 ? (
        <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
          Файл не содержал позиций.
        </div>
      ) : null}
    </div>
  );
}
