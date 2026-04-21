"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError, materialApi } from "@/lib/api/client";
import { getWorkspaceId } from "@/lib/workspace";
import { cn, formatCurrency } from "@/lib/utils";
import type {
  EstimateItem,
  MaterialMatchBucket,
  MaterialMatchResult,
  UUID,
} from "@/lib/api/types";

interface Props {
  estimateId: UUID;
  items: EstimateItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BUCKET_LABELS: Record<MaterialMatchBucket, string> = {
  green: "Уверенно",
  yellow: "Проверить",
  red: "Не найдено",
};

const BUCKET_CLASSES: Record<MaterialMatchBucket, string> = {
  green: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
  yellow: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  red: "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100",
};

export function MaterialsMatchingDialog({
  estimateId,
  items,
  open,
  onOpenChange,
}: Props) {
  const workspaceId = getWorkspaceId();
  const qc = useQueryClient();

  // Загружаем сессию матчинга только пока диалог открыт.
  const matchQ = useQuery({
    queryKey: ["materials-match", estimateId, workspaceId],
    queryFn: () => materialApi.match(estimateId, workspaceId),
    enabled: open,
    staleTime: 0,
  });

  const results = React.useMemo(
    () => matchQ.data?.results ?? [],
    [matchQ.data],
  );
  const greenIds = React.useMemo(
    () =>
      new Set(
        results.filter((r) => r.bucket === "green").map((r) => r.item_id),
      ),
    [results],
  );
  const yellowIds = React.useMemo(
    () =>
      results.filter((r) => r.bucket === "yellow").map((r) => r.item_id),
    [results],
  );

  const itemNameById = React.useMemo(() => {
    const m = new Map<UUID, string>();
    for (const it of items) m.set(it.id, it.name);
    return m;
  }, [items]);

  const [selectedYellow, setSelectedYellow] = React.useState<Set<UUID>>(
    () => new Set(),
  );

  // При каждом открытии / обновлении результатов — сбрасываем выбор жёлтых.
  React.useEffect(() => {
    if (!open) return;
    setSelectedYellow(new Set());
  }, [open, matchQ.data?.session_id]);

  const toggleYellow = (itemId: UUID) =>
    setSelectedYellow((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });

  const applyMut = useMutation({
    mutationFn: (matches: MaterialMatchResult[]) =>
      materialApi.apply(
        estimateId,
        matches.map((m) => ({
          item_id: m.item_id,
          material_price: m.material_price,
        })),
        workspaceId,
      ),
    onSuccess: async (res) => {
      await Promise.all([
        qc.refetchQueries({
          queryKey: ["estimate-items", estimateId],
          type: "active",
        }),
        qc.refetchQueries({
          queryKey: ["estimate", estimateId],
          type: "active",
        }),
      ]);
      toast.success(`Применено: ${res.updated} позиций`);
      onOpenChange(false);
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError) {
        toast.error(e.problem?.detail ?? "Не удалось применить матчи");
      } else {
        toast.error("Не удалось применить матчи");
      }
    },
  });

  const applyGreen = () => {
    const green = results.filter((r) => r.bucket === "green");
    if (green.length === 0) {
      toast.info("Зелёных матчей нет");
      return;
    }
    applyMut.mutate(green);
  };

  const applySelected = () => {
    const picked = results.filter(
      (r) =>
        r.bucket === "green" ||
        (r.bucket === "yellow" && selectedYellow.has(r.item_id)),
    );
    if (picked.length === 0) {
      toast.info("Ничего не выбрано");
      return;
    }
    applyMut.mutate(picked);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl"
        data-testid="materials-matching-dialog"
      >
        <DialogHeader>
          <DialogTitle>Подбор материалов из справочника</DialogTitle>
          <DialogDescription>
            Fuzzy-поиск по названию, бренду и модели. Зелёные (≥90%) применяются
            автоматически. Жёлтые (70–89%) — подтверждаете галочкой.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[240px] max-h-[60vh] overflow-auto">
          {matchQ.isPending ? (
            <div
              className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"
              data-testid="materials-match-loading"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              Подбираем материалы…
            </div>
          ) : matchQ.isError ? (
            <div
              className="py-10 text-center text-sm text-destructive"
              data-testid="materials-match-error"
            >
              Не удалось загрузить подбор. Проверьте соединение и повторите.
            </div>
          ) : results.length === 0 ? (
            <div
              className="py-10 text-center text-sm text-muted-foreground"
              data-testid="materials-match-empty"
            >
              Совпадений в справочнике не найдено. Заполните каталог Material
              в workspace или отредактируйте позиции.
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="w-[36px]">
                    <span className="sr-only">Выбор</span>
                  </TableHead>
                  <TableHead>Позиция</TableHead>
                  <TableHead>Подобран материал</TableHead>
                  <TableHead className="text-right">Цена</TableHead>
                  <TableHead>Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r) => {
                  const confidencePct = Math.round(
                    Number.parseFloat(r.confidence) * 100,
                  );
                  const isGreen = r.bucket === "green";
                  const isYellow = r.bucket === "yellow";
                  const checked =
                    isGreen || (isYellow && selectedYellow.has(r.item_id));
                  return (
                    <TableRow
                      key={r.item_id}
                      data-testid={`materials-match-row-${r.item_id}`}
                      data-bucket={r.bucket}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isGreen}
                          onChange={() => toggleYellow(r.item_id)}
                          aria-label={
                            isGreen
                              ? "Зелёные применяются автоматически"
                              : "Подтвердить желтый матч"
                          }
                          data-testid={`materials-match-checkbox-${r.item_id}`}
                        />
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate">
                        {itemNameById.get(r.item_id) ?? r.item_id}
                      </TableCell>
                      <TableCell className="max-w-[240px]">
                        <div className="truncate font-medium">
                          {r.material_name}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {r.material_unit}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(r.material_price)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(BUCKET_CLASSES[r.bucket])}
                          data-testid={`materials-match-bucket-${r.item_id}`}
                        >
                          {BUCKET_LABELS[r.bucket]} · {confidencePct}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <div className="mr-auto text-xs text-muted-foreground">
            Зелёных: {greenIds.size} · Жёлтых: {yellowIds.length} · Выбрано
            жёлтых: {selectedYellow.size}
          </div>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={applyMut.isPending}
          >
            Отмена
          </Button>
          <Button
            variant="outline"
            onClick={applyGreen}
            disabled={applyMut.isPending || greenIds.size === 0}
            data-testid="materials-apply-green"
          >
            Применить зелёные ({greenIds.size})
          </Button>
          <Button
            onClick={applySelected}
            disabled={
              applyMut.isPending ||
              (greenIds.size === 0 && selectedYellow.size === 0)
            }
            data-testid="materials-apply-selected"
          >
            {applyMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Применить выбранные ({greenIds.size + selectedYellow.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
