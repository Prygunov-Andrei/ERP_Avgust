import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, TKPFrontOfWork } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FileText, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDate } from '@/lib/utils';
import { CONSTANTS } from '@/constants';

interface FrontOfWorkTabProps {
  tkpId: number;
  frontOfWork: TKPFrontOfWork[];
}

export function FrontOfWorkTab({ tkpId, frontOfWork }: FrontOfWorkTabProps) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteFrontTarget, setDeleteFrontTarget] = useState<{ id: number; name: string } | null>(null);
  const [formData, setFormData] = useState({
    front_item: "",
    when_text: "",
    when_date: "",
  });

  // Загрузка элементов фронта работ
  const { data: frontItems } = useQuery({
    queryKey: ["front-of-work-items"],
    queryFn: () => api.proposals.getFrontOfWorkItems(),
    enabled: isAdding,
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
  });

  // Создание элемента
  const createMutation = useMutation({
    mutationFn: (data: { front_item: number; when_text?: string; when_date?: string }) =>
      api.proposals.createTKPFrontOfWork({ tkp: tkpId, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tkp-front-of-work", tkpId.toString()] });
      queryClient.invalidateQueries({ queryKey: ["technical-proposal", tkpId.toString()] });
      toast.success("Элемент добавлен");
      setIsAdding(false);
      setFormData({ front_item: "", when_text: "", when_date: "" });
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  // Обновление элемента
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<{ when_text: string; when_date: string }> }) =>
      api.proposals.updateTKPFrontOfWork(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tkp-front-of-work", tkpId.toString()] });
      queryClient.invalidateQueries({ queryKey: ["technical-proposal", tkpId.toString()] });
      toast.success("Элемент обновлен");
      setEditingId(null);
      setFormData({ front_item: "", when_text: "", when_date: "" });
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  // Удаление элемента
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.proposals.deleteTKPFrontOfWork(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tkp-front-of-work", tkpId.toString()] });
      queryClient.invalidateQueries({ queryKey: ["technical-proposal", tkpId.toString()] });
      toast.success("Элемент удален");
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        data: {
          when_text: formData.when_text,
          when_date: formData.when_date || undefined,
        },
      });
    } else {
      createMutation.mutate({
        front_item: parseInt(formData.front_item),
        when_text: formData.when_text || undefined,
        when_date: formData.when_date || undefined,
      });
    }
  };

  const handleEdit = (item: TKPFrontOfWork) => {
    setEditingId(item.id);
    setFormData({
      front_item: item.front_item.toString(),
      when_text: item.when_text,
      when_date: item.when_date || "",
    });
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ front_item: "", when_text: "", when_date: "" });
  };

  const formatDateOrDash = (dateString: string | null) => {
    if (!dateString) return "-";
    return formatDate(dateString);
  };

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-foreground">Фронт работ</h2>
        {!isAdding && (
          <Button
            onClick={() => setIsAdding(true)}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Добавить
          </Button>
        )}
      </div>

      {isAdding && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 p-4 bg-muted rounded-lg border border-border"
        >
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <Label htmlFor="front_item">Элемент фронта работ</Label>
              <select
                id="front_item"
                value={formData.front_item}
                onChange={(e) => setFormData({ ...formData, front_item: e.target.value })}
                required={!editingId}
                disabled={!!editingId}
                className="mt-1.5 w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Выберите элемент</option>
                {frontItems?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="when_text">Когда (текст)</Label>
              <Input
                id="when_text"
                value={formData.when_text}
                onChange={(e) => setFormData({ ...formData, when_text: e.target.value })}
                placeholder="Описание срока"
              />
            </div>
            <div>
              <Label htmlFor="when_date">Когда (дата)</Label>
              <Input
                id="when_date"
                type="date"
                value={formData.when_date}
                onChange={(e) => setFormData({ ...formData, when_date: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700">
              {editingId ? "Сохранить" : "Добавить"}
            </Button>
            <Button
              type="button"
              onClick={handleCancel}
              className="bg-muted text-foreground hover:bg-muted"
            >
              Отмена
            </Button>
          </div>
        </form>
      )}

      {frontOfWork.length === 0 && !isAdding ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p>Фронт работ не добавлен</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-y border-border">
              <tr>
                <th className="px-4 py-3 text-left text-muted-foreground">Элемент</th>
                <th className="px-4 py-3 text-left text-muted-foreground">Категория</th>
                <th className="px-4 py-3 text-left text-muted-foreground">Когда (текст)</th>
                <th className="px-4 py-3 text-left text-muted-foreground">Когда (дата)</th>
                <th className="px-4 py-3 text-right text-muted-foreground">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {frontOfWork.map((item) => (
                <tr key={item.id} className="hover:bg-muted">
                  <td className="px-4 py-3 text-foreground">{item.front_item_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.front_item_category}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.when_text || "-"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateOrDash(item.when_date)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        onClick={() => handleEdit(item)}
                        className="bg-muted text-foreground hover:bg-muted px-3"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => setDeleteFrontTarget({ id: item.id, name: item.front_item_name })}
                        className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 px-3"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!deleteFrontTarget} onOpenChange={(open) => { if (!open) setDeleteFrontTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удаление элемента фронта работ</AlertDialogTitle>
            <AlertDialogDescription>
              Удалить элемент «{deleteFrontTarget?.name}»?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteFrontTarget) { deleteMutation.mutate(deleteFrontTarget.id); setDeleteFrontTarget(null); } }} className="bg-red-600 hover:bg-red-700">Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
