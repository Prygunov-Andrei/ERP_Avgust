"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError, sectionApi } from "@/lib/api/client";
import { getWorkspaceId } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import type { EstimateSection, UUID } from "@/lib/api/types";

interface Props {
  estimateId: UUID;
  sections: EstimateSection[];
  selectedId: UUID | null;
  onSelect: (id: UUID | null) => void;
}

export function SectionsPanel({
  estimateId,
  sections,
  selectedId,
  onSelect,
}: Props) {
  const qc = useQueryClient();
  const workspaceId = getWorkspaceId();

  const [addingName, setAddingName] = React.useState<string | null>(null);
  const [renamingId, setRenamingId] = React.useState<UUID | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [pendingDelete, setPendingDelete] =
    React.useState<EstimateSection | null>(null);

  const invalidateSections = () =>
    qc.invalidateQueries({ queryKey: ["estimate-sections", estimateId] });

  const create = useMutation({
    mutationFn: (name: string) =>
      sectionApi.create(
        estimateId,
        { name, sort_order: sections.length },
        workspaceId,
      ),
    onSuccess: (section) => {
      invalidateSections();
      setAddingName(null);
      onSelect(section.id);
      toast.success("Раздел добавлен");
    },
    onError: () => toast.error("Не удалось создать раздел"),
  });

  const rename = useMutation({
    mutationFn: (args: { id: UUID; name: string; version: number }) =>
      sectionApi.update(args.id, { name: args.name }, args.version, workspaceId),
    onSuccess: () => {
      invalidateSections();
      setRenamingId(null);
      toast.success("Раздел переименован");
    },
    onError: (e: unknown) => {
      setRenamingId(null);
      if (e instanceof ApiError && e.status === 409) {
        toast.error("Кто-то обновил раздел. Обновите страницу.");
        invalidateSections();
      } else {
        toast.error("Не удалось переименовать раздел");
      }
    },
  });

  const remove = useMutation({
    mutationFn: (id: UUID) => sectionApi.delete(id, workspaceId),
    onSuccess: (_data, id) => {
      invalidateSections();
      qc.invalidateQueries({ queryKey: ["estimate-items", estimateId] });
      setPendingDelete(null);
      if (selectedId === id) onSelect(null);
      toast.success("Раздел удалён");
    },
    onError: () => {
      setPendingDelete(null);
      toast.error("Не удалось удалить раздел");
    },
  });

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-card">
      <div className="flex h-10 items-center justify-between border-b px-3">
        <h2 className="text-sm font-semibold">Разделы</h2>
        <span className="text-xs text-muted-foreground">{sections.length}</span>
      </div>

      <nav className="flex-1 overflow-auto p-2">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={cn(
            "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
            selectedId === null
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          )}
        >
          Все разделы
        </button>

        <div className="mt-1 flex flex-col gap-0.5">
          {sections.map((section) => {
            const active = section.id === selectedId;
            const isRenaming = renamingId === section.id;
            return (
              <div
                key={section.id}
                className={cn(
                  "group flex items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                {isRenaming ? (
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => {
                      const next = renameValue.trim();
                      if (!next || next === section.name) {
                        setRenamingId(null);
                        return;
                      }
                      rename.mutate({
                        id: section.id,
                        name: next,
                        version: section.version,
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    className="h-7 flex-1 text-sm"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelect(section.id)}
                    onDoubleClick={() => {
                      setRenamingId(section.id);
                      setRenameValue(section.name);
                    }}
                    className={cn(
                      "flex-1 truncate rounded px-1 py-1 text-left",
                      active && "font-medium",
                    )}
                    title="Двойной клик — переименовать"
                  >
                    {section.name}
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDelete(section);
                  }}
                  aria-label={`Удалить раздел ${section.name}`}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            );
          })}
        </div>

        {addingName !== null ? (
          <Input
            autoFocus
            value={addingName}
            onChange={(e) => setAddingName(e.target.value)}
            onBlur={() => {
              const next = addingName.trim();
              if (next) {
                create.mutate(next);
              } else {
                setAddingName(null);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setAddingName(null);
            }}
            placeholder="Название раздела"
            className="mt-2 h-8 text-sm"
          />
        ) : (
          <Button
            type="button"
            variant="ghost"
            className="mt-2 h-8 w-full justify-start text-sm text-muted-foreground"
            onClick={() => setAddingName("")}
          >
            <Plus className="h-4 w-4" />
            Добавить раздел
          </Button>
        )}
      </nav>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить раздел?</DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? `Раздел «${pendingDelete.name}» и все его позиции будут удалены. Действие нельзя отменить.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={remove.isPending}
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                pendingDelete && remove.mutate(pendingDelete.id)
              }
              disabled={remove.isPending}
            >
              {remove.isPending ? "Удаляется..." : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
