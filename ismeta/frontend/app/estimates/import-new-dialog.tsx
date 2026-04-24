"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Loader2,
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError, estimateApi, importApi } from "@/lib/api/client";
import { getWorkspaceId } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import type { ExcelImportResult } from "@/lib/api/types";

const ACCEPT =
  ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function isXlsx(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith(".xlsx") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

function stripExt(name: string): string {
  return name.replace(/\.xlsx$/i, "").trim();
}

export function ImportNewEstimateDialog() {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const qc = useQueryClient();
  const workspaceId = getWorkspaceId();

  const reset = React.useCallback(() => {
    setName("");
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const submit = useMutation({
    mutationFn: async (args: { name: string; file: File }) => {
      if (!args.name.trim()) throw new Error("Укажите название");
      const estimate = await estimateApi.create(
        { name: args.name.trim() },
        workspaceId,
      );
      try {
        await importApi.uploadExcel(estimate.id, args.file, workspaceId);
      } catch (e) {
        if (
          e instanceof ApiError &&
          e.problem &&
          typeof e.problem === "object" &&
          Array.isArray((e.problem as { errors?: unknown }).errors)
        ) {
          const p = e.problem as unknown as Partial<ExcelImportResult>;
          const errorsCount = p.errors?.length ?? 0;
          // частичные ошибки — смета создана, показываем количество
          toast.info(
            `Импортировано с ошибками: ${errorsCount}. Откройте смету, чтобы исправить.`,
          );
        } else {
          throw e;
        }
      }
      return estimate;
    },
    onSuccess: (estimate) => {
      qc.invalidateQueries({ queryKey: ["estimates"] });
      toast.success(`Смета «${estimate.name}» создана`);
      setOpen(false);
      reset();
      router.push(`/estimates/${estimate.id}`);
    },
    onError: (e: unknown) => {
      if (e instanceof Error) toast.error(e.message);
      else toast.error("Импорт не удался");
    },
  });

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const first = files[0]!;
    if (!isXlsx(first)) {
      toast.error("Нужен файл .xlsx");
      return;
    }
    setFile(first);
    if (!name.trim()) setName(stripExt(first.name));
  };

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="import-new-trigger">
          <Upload className="h-4 w-4" />
          Загрузить Excel
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="import-new-dialog">
        <DialogHeader>
          <DialogTitle>Импорт Excel — новая смета</DialogTitle>
          <DialogDescription>
            Новая смета будет создана из загруженного .xlsx. Имя по умолчанию
            — из имени файла.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!file) return;
            submit.mutate({ name, file });
          }}
          className="flex flex-col gap-3"
        >
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Название *</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например, Вентиляция корпус А"
              disabled={submit.isPending}
              aria-label="Название сметы"
            />
          </label>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
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
            data-testid="import-new-dropzone"
            data-dragging={isDragging || undefined}
            className={cn(
              "flex min-h-[120px] w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-4 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 bg-muted/20 hover:border-muted-foreground/50",
            )}
          >
            <FileSpreadsheet
              className={cn(
                "h-7 w-7",
                file ? "text-primary" : "text-muted-foreground",
              )}
              aria-hidden
            />
            {file ? (
              <>
                <span className="font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {Math.round(file.size / 1024)} КБ
                </span>
              </>
            ) : (
              <>
                <span className="font-medium">Перетащите .xlsx файл сюда</span>
                <span className="text-xs text-muted-foreground">
                  или нажмите, чтобы выбрать
                </span>
              </>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            aria-label="Выбрать .xlsx файл"
            onChange={(e) => handleFiles(e.target.files)}
            className="sr-only"
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => close(false)}
              disabled={submit.isPending}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={!file || !name.trim() || submit.isPending}
              data-testid="import-new-submit"
            >
              {submit.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Создать и импортировать
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
