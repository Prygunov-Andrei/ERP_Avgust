"use client";

import { FileSpreadsheet } from "lucide-react";

import { ImportNewEstimateDialog } from "./import-new-dialog";
import { NewEstimateDialog } from "./new-estimate-dialog";

export function EmptyEstimatesState() {
  return (
    <div
      role="status"
      data-testid="estimates-empty-state"
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 px-6 py-16 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <FileSpreadsheet className="h-7 w-7" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold">Создайте первую смету</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Начните с пустой или загрузите свою смету из Excel — разделы
        и позиции появятся в редакторе, ИИ подберёт работы и проверит цены.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <NewEstimateDialog />
        <ImportNewEstimateDialog />
      </div>
    </div>
  );
}
