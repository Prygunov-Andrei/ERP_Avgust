"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2 } from "lucide-react";
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
import type { RecognitionJob, UUID } from "@/lib/api/types";

interface Props {
  estimateId: UUID;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Stage = "choose" | "submitting";

export function PdfImportDialog({ estimateId, open, onOpenChange }: Props) {
  const workspaceId = getWorkspaceId();
  const qc = useQueryClient();
  const [stage, setStage] = React.useState<Stage>("choose");
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!open) setStage("choose");
  }, [open]);

  const submit = useMutation({
    mutationFn: ({ file }: { file: File }) =>
      importApi.uploadPdfAsync(estimateId, file, workspaceId),
    onSuccess: (job: RecognitionJob, vars) => {
      toast.success(`Распознавание «${vars.file.name}» запущено`, {
        description: "Можете продолжать работу — следите за прогрессом в шапке.",
        duration: 5_000,
      });
      qc.invalidateQueries({ queryKey: ["recognition-jobs"] });
      // Также инвалидируем queries сметы, чтобы сразу показался банер.
      qc.invalidateQueries({
        queryKey: ["recognition-jobs", "for-estimate", job.estimate_id],
      });
      onOpenChange(false);
    },
    onError: (e: unknown) => {
      setStage("choose");
      if (e instanceof ApiError) {
        toast.error(e.problem?.detail ?? e.message ?? "Ошибка запуска распознавания");
      } else {
        toast.error("Не удалось запустить распознавание PDF");
      }
    },
  });

  const handleFile = React.useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        toast.error("Нужен файл .pdf");
        return;
      }
      setStage("submitting");
      submit.mutate({ file });
    },
    [submit],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Загрузить PDF-спецификацию</DialogTitle>
          <DialogDescription>
            Распознавание идёт в фоне. После запуска можно сразу продолжать
            работать — прогресс будет в шапке.
          </DialogDescription>
        </DialogHeader>

        {stage === "choose" && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/30"
            data-testid="pdf-import-dropzone"
          >
            <FileText className="h-10 w-10 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              Перетащите PDF сюда или нажмите для выбора
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              data-testid="pdf-import-input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                // сбросить input, чтобы повторный выбор того же файла снова сработал
                e.target.value = "";
              }}
            />
          </div>
        )}

        {stage === "submitting" && (
          <div
            data-testid="pdf-import-submitting"
            className="flex flex-col items-center gap-3 py-8"
          >
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-sm font-medium">Запускаем распознавание…</div>
          </div>
        )}

        <DialogFooter>
          {stage === "choose" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
