"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EditableCell } from "./editable-cell";
import { ApiError, itemApi } from "@/lib/api/client";
import { getWorkspaceId } from "@/lib/workspace";
import { formatCurrency } from "@/lib/utils";
import {
  MATCH_SOURCE_LABELS,
  type CreateItemDto,
  type EstimateItem,
  type UUID,
} from "@/lib/api/types";

interface Props {
  estimateId: UUID;
  items: EstimateItem[];
  isLoading?: boolean;
  activeSectionId: UUID | null;
  fallbackSectionId: UUID | null;
}

export function ItemsTable({
  estimateId,
  items,
  isLoading,
  activeSectionId,
  fallbackSectionId,
}: Props) {
  const qc = useQueryClient();
  const workspaceId = getWorkspaceId();

  const invalidate = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: ["estimate-items", estimateId] });
    qc.invalidateQueries({ queryKey: ["estimate", estimateId] });
  }, [qc, estimateId]);

  const update = useMutation({
    mutationFn: ({
      item,
      patch,
    }: {
      item: EstimateItem;
      patch: Partial<EstimateItem>;
    }) => itemApi.update(item.id, patch, item.version, workspaceId),
    onSuccess: () => invalidate(),
    onError: (e: unknown) => {
      if (e instanceof ApiError && e.status === 409) {
        toast.error("Кто-то обновил эту строку. Обновите страницу.");
      } else if (e instanceof ApiError) {
        toast.error(e.problem?.detail ?? "Ошибка сохранения");
      } else {
        toast.error("Не удалось сохранить изменение");
      }
      invalidate();
    },
  });

  const create = useMutation({
    mutationFn: (data: CreateItemDto) =>
      itemApi.create(estimateId, data, workspaceId),
    onSuccess: () => {
      invalidate();
      toast.success("Позиция добавлена");
    },
    onError: () => toast.error("Не удалось добавить позицию"),
  });

  const remove = useMutation({
    mutationFn: (item: EstimateItem) =>
      itemApi.softDelete(item.id, item.version, workspaceId),
    onSuccess: () => {
      invalidate();
      toast.success("Позиция удалена");
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError && e.status === 409) {
        toast.error("Кто-то обновил строку. Обновите страницу.");
      } else {
        toast.error("Не удалось удалить позицию");
      }
      invalidate();
    },
  });

  const commitField = React.useCallback(
    (item: EstimateItem, field: keyof EstimateItem, raw: string) => {
      const isNumeric =
        field === "quantity" ||
        field === "equipment_price" ||
        field === "material_price" ||
        field === "work_price";
      if (isNumeric) {
        const n = Number.parseFloat(raw.replace(",", "."));
        if (!Number.isFinite(n) || n < 0) {
          toast.error("Нужно неотрицательное число");
          return;
        }
        update.mutate({ item, patch: { [field]: String(n) } as Partial<EstimateItem> });
      } else {
        update.mutate({ item, patch: { [field]: raw } as Partial<EstimateItem> });
      }
    },
    [update],
  );

  const columns = React.useMemo<ColumnDef<EstimateItem>[]>(
    () => [
      {
        id: "row",
        header: "№",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground tabular-nums">
            {row.index + 1}
          </span>
        ),
        size: 40,
      },
      {
        accessorKey: "name",
        header: "Наименование",
        cell: ({ row }) => (
          <EditableCell
            value={row.original.name}
            onCommit={(next) => commitField(row.original, "name", next)}
          />
        ),
      },
      {
        accessorKey: "unit",
        header: "Ед.изм.",
        cell: ({ row }) => (
          <EditableCell
            value={row.original.unit}
            onCommit={(next) => commitField(row.original, "unit", next)}
          />
        ),
        size: 80,
      },
      {
        accessorKey: "quantity",
        header: () => <span className="block text-right">Кол-во</span>,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.quantity}
            type="number"
            align="right"
            onCommit={(next) => commitField(row.original, "quantity", next)}
          />
        ),
        size: 90,
      },
      {
        accessorKey: "equipment_price",
        header: () => <span className="block text-right">Цена обор.</span>,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.equipment_price}
            type="number"
            align="right"
            display={(v) => formatCurrency(v)}
            onCommit={(next) => commitField(row.original, "equipment_price", next)}
          />
        ),
        size: 120,
      },
      {
        accessorKey: "material_price",
        header: () => <span className="block text-right">Цена мат.</span>,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.material_price}
            type="number"
            align="right"
            display={(v) => formatCurrency(v)}
            onCommit={(next) => commitField(row.original, "material_price", next)}
          />
        ),
        size: 120,
      },
      {
        accessorKey: "work_price",
        header: () => <span className="block text-right">Цена работ</span>,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.work_price}
            type="number"
            align="right"
            display={(v) => formatCurrency(v)}
            onCommit={(next) => commitField(row.original, "work_price", next)}
          />
        ),
        size: 120,
      },
      {
        accessorKey: "total",
        header: () => <span className="block text-right">Итого</span>,
        cell: ({ row }) => (
          <span className="block px-2 text-right text-sm font-medium tabular-nums">
            {formatCurrency(row.original.total)}
          </span>
        ),
        size: 130,
      },
      {
        accessorKey: "match_source",
        header: "Подбор",
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.match_source === "unmatched" ? "outline" : "secondary"
            }
          >
            {MATCH_SOURCE_LABELS[row.original.match_source]}
          </Badge>
        ),
        size: 110,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Удалить позицию"
            onClick={() => remove.mutate(row.original)}
            disabled={remove.isPending}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
          </Button>
        ),
        size: 48,
      },
    ],
    [commitField, remove],
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const totals = React.useMemo(() => {
    let equipment = 0;
    let material = 0;
    let work = 0;
    let total = 0;
    for (const it of items) {
      equipment += Number.parseFloat(it.equipment_total) || 0;
      material += Number.parseFloat(it.material_total) || 0;
      work += Number.parseFloat(it.work_total) || 0;
      total += Number.parseFloat(it.total) || 0;
    }
    return { equipment, material, work, total };
  }, [items]);

  const sectionIdForNew = activeSectionId ?? fallbackSectionId;
  const canAdd = Boolean(sectionIdForNew);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} style={{ width: h.getSize() }}>
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skel-${i}`}>
                  {columns.map((_c, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-20 text-center text-sm text-muted-foreground"
                >
                  В этом разделе пока нет позиций
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="p-1 align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
            <TableRow>
              <TableCell colSpan={columns.length} className="p-0">
                <Button
                  variant="ghost"
                  className="h-10 w-full justify-start gap-2 rounded-none text-sm text-muted-foreground"
                  disabled={!canAdd || create.isPending}
                  title={
                    canAdd
                      ? undefined
                      : "Сначала создайте раздел, чтобы добавить позицию"
                  }
                  onClick={() => {
                    if (!sectionIdForNew) return;
                    create.mutate({
                      section_id: sectionIdForNew,
                      name: "Новая позиция",
                      unit: "шт",
                      quantity: 1,
                      equipment_price: 0,
                      material_price: 0,
                      work_price: 0,
                      sort_order: items.length,
                    });
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Добавить позицию
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end gap-6 border-t bg-muted/30 px-6 py-3 text-sm tabular-nums">
        <span className="text-muted-foreground">
          Оборудование:{" "}
          <span className="font-medium text-foreground">
            {formatCurrency(totals.equipment)}
          </span>
        </span>
        <span className="text-muted-foreground">
          Материалы:{" "}
          <span className="font-medium text-foreground">
            {formatCurrency(totals.material)}
          </span>
        </span>
        <span className="text-muted-foreground">
          Работы:{" "}
          <span className="font-medium text-foreground">
            {formatCurrency(totals.work)}
          </span>
        </span>
        <span className="text-base font-semibold">
          Итого: {formatCurrency(totals.total)}
        </span>
      </div>
    </div>
  );
}
