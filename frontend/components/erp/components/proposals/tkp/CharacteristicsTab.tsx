import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, TKPCharacteristic } from "@/lib/api";
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
import { formatCurrency } from '@/lib/utils';

interface CharacteristicsTabProps {
  tkpId: number;
  characteristics: TKPCharacteristic[];
}

export function CharacteristicsTab({ tkpId, characteristics }: CharacteristicsTabProps) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteCharTarget, setDeleteCharTarget] = useState<{ id: number; name: string } | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    purchase_amount: "",
    sale_amount: "",
  });

  // Создание характеристики
  const createMutation = useMutation({
    mutationFn: (data: { name: string; purchase_amount: string; sale_amount: string }) =>
      api.proposals.createTKPCharacteristic({ tkp: tkpId, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tkp-characteristics", tkpId.toString()] });
      queryClient.invalidateQueries({ queryKey: ["technical-proposal", tkpId.toString()] });
      toast.success("Характеристика добавлена");
      setIsAdding(false);
      setFormData({ name: "", purchase_amount: "", sale_amount: "" });
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  // Обновление характеристики
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof formData> }) =>
      api.proposals.updateTKPCharacteristic(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tkp-characteristics", tkpId.toString()] });
      queryClient.invalidateQueries({ queryKey: ["technical-proposal", tkpId.toString()] });
      toast.success("Характеристика обновлена");
      setEditingId(null);
      setFormData({ name: "", purchase_amount: "", sale_amount: "" });
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  // Удаление характеристики
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.proposals.deleteTKPCharacteristic(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tkp-characteristics", tkpId.toString()] });
      queryClient.invalidateQueries({ queryKey: ["technical-proposal", tkpId.toString()] });
      toast.success("Характеристика удалена");
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (char: TKPCharacteristic) => {
    setEditingId(char.id);
    setFormData({
      name: char.name,
      purchase_amount: char.purchase_amount,
      sale_amount: char.sale_amount,
    });
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ name: "", purchase_amount: "", sale_amount: "" });
  };

  const calculateProfit = (sale: string, purchase: string) => {
    const saleNum = parseFloat(sale) || 0;
    const purchaseNum = parseFloat(purchase) || 0;
    return saleNum - purchaseNum;
  };

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-foreground">Характеристики</h2>
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
              <Label htmlFor="name">Название</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Введите название"
              />
            </div>
            <div>
              <Label htmlFor="purchase_amount">Сумма закупки</Label>
              <Input
                id="purchase_amount"
                type="number"
                step="0.01"
                value={formData.purchase_amount}
                onChange={(e) => setFormData({ ...formData, purchase_amount: e.target.value })}
                required
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="sale_amount">Сумма продажи</Label>
              <Input
                id="sale_amount"
                type="number"
                step="0.01"
                value={formData.sale_amount}
                onChange={(e) => setFormData({ ...formData, sale_amount: e.target.value })}
                required
                placeholder="0.00"
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

      {characteristics.length === 0 && !isAdding ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p>Характеристики не добавлены</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-y border-border">
              <tr>
                <th className="px-4 py-3 text-left text-muted-foreground">Название</th>
                <th className="px-4 py-3 text-right text-muted-foreground">Сумма закупки</th>
                <th className="px-4 py-3 text-right text-muted-foreground">Сумма продажи</th>
                <th className="px-4 py-3 text-right text-muted-foreground">Прибыль</th>
                <th className="px-4 py-3 text-right text-muted-foreground">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {characteristics.map((char) => (
                <tr key={char.id} className="hover:bg-muted">
                  <td className="px-4 py-3 text-foreground">{char.name}</td>
                  <td className="px-4 py-3 text-right text-foreground">
                    {formatCurrency(char.purchase_amount)}
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">
                    {formatCurrency(char.sale_amount)}
                  </td>
                  <td className="px-4 py-3 text-right text-green-700">
                    {formatCurrency(calculateProfit(char.sale_amount, char.purchase_amount))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        onClick={() => handleEdit(char)}
                        className="bg-muted text-foreground hover:bg-muted px-3"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => setDeleteCharTarget({ id: char.id, name: char.name })}
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

      <AlertDialog open={!!deleteCharTarget} onOpenChange={(open) => { if (!open) setDeleteCharTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удаление характеристики</AlertDialogTitle>
            <AlertDialogDescription>
              Удалить характеристику «{deleteCharTarget?.name}»?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteCharTarget) { deleteMutation.mutate(deleteCharTarget.id); setDeleteCharTarget(null); } }} className="bg-red-600 hover:bg-red-700">Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
