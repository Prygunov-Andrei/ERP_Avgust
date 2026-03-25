import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@/hooks/erp-router';
import { X } from 'lucide-react';
import { api, MountingCondition, Counterparty } from '@/lib/api';
import { CONSTANTS } from '@/constants';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface CreateMountingProposalFromTKPDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tkpId: number;
  tkpNumber: string;
  tkpName: string;
  tkpObjectId?: number;
}

export function CreateMountingProposalFromTKPDialog({
  open,
  onOpenChange,
  tkpId,
  tkpNumber,
  tkpName,
  tkpObjectId,
}: CreateMountingProposalFromTKPDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    counterparty: '',
    total_amount: '',
    man_hours: '',
    notes: '',
  });
  const [selectedMountingEstimateIds, setSelectedMountingEstimateIds] = useState<number[]>([]);
  const [selectedConditionIds, setSelectedConditionIds] = useState<number[]>([]);
  const [conditionsLoaded, setConditionsLoaded] = useState(false);

  const { data: counterparties } = useQuery({
    queryKey: ['counterparties-executors'],
    queryFn: async () => {
      const all = await api.core.getCounterparties({ type: 'vendor' });
      return all.filter((c) => c.vendor_subtype === 'executor' || c.vendor_subtype === 'both');
    },
    enabled: open,
    staleTime: CONSTANTS.REFERENCE_STALE_TIME_MS,
  });

  const { data: mountingEstimates } = useQuery({
    queryKey: ['mounting-estimates', tkpObjectId],
    queryFn: () => api.estimates.getMountingEstimates(tkpObjectId ? { object: tkpObjectId } : undefined),
    enabled: open,
    staleTime: CONSTANTS.REFERENCE_STALE_TIME_MS,
  });

  const { data: conditions } = useQuery({
    queryKey: ['mounting-conditions-active'],
    queryFn: () => api.proposals.getMountingConditions({ is_active: true }),
    enabled: open,
    staleTime: CONSTANTS.REFERENCE_STALE_TIME_MS,
  });

  useEffect(() => {
    if (conditions && !conditionsLoaded) {
      const defaultIds = conditions
        .filter((c: MountingCondition) => c.is_default)
        .map((c: MountingCondition) => c.id);
      setSelectedConditionIds(defaultIds);
      setConditionsLoaded(true);
    }
  }, [conditions, conditionsLoaded]);

  const createMutation = useMutation({
    mutationFn: () => {
      const data: Record<string, unknown> = {
        counterparty: parseInt(formData.counterparty),
      };

      if (selectedMountingEstimateIds.length > 0) {
        data.mounting_estimates_ids = selectedMountingEstimateIds;
      }
      if (formData.total_amount) {
        data.total_amount = formData.total_amount;
      }
      if (formData.man_hours) {
        data.man_hours = formData.man_hours;
      }
      if (formData.notes) {
        data.notes = formData.notes;
      }
      if (selectedConditionIds.length > 0) {
        data.conditions_ids = selectedConditionIds;
      }

      return api.proposals.createMountingProposalFromTKP(tkpId, data as { counterparty: number; notes?: string });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mounting-proposals'] });
      toast.success('МП создано из ТКП');
      onOpenChange(false);
      navigate(`/proposals/mounting-proposals/${data.id}`);
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  const handleMountingEstimateToggle = (id: number) => {
    setSelectedMountingEstimateIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleConditionToggle = (conditionId: number) => {
    setSelectedConditionIds((prev) =>
      prev.includes(conditionId)
        ? prev.filter((id) => id !== conditionId)
        : [...prev, conditionId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-foreground">Создать МП из ТКП</h2>
            <p className="text-muted-foreground">
              ТКП № {tkpNumber}: {tkpName}
            </p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-muted-foreground"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="space-y-4">
            <div>
              <Label htmlFor="counterparty">
                Исполнитель <span className="text-red-500">*</span>
              </Label>
              <select
                id="counterparty"
                value={formData.counterparty}
                onChange={(e) => setFormData({ ...formData, counterparty: e.target.value })}
                required
                className="mt-1.5 w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Выберите исполнителя</option>
                {counterparties?.map((c: Counterparty) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Монтажные сметы</Label>
              {mountingEstimates && mountingEstimates.length > 0 ? (
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border border-border rounded-lg p-3">
                  {mountingEstimates.map((est) => (
                    <label
                      key={est.id}
                      className="flex items-start gap-2 cursor-pointer hover:bg-muted p-2 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMountingEstimateIds.includes(est.id)}
                        onChange={() => handleMountingEstimateToggle(est.id)}
                        className="mt-1"
                      />
                      <div>
                        <div className="text-foreground">{est.number} - {est.name}</div>
                        <div className="text-muted-foreground">
                          {Number(est.total_amount).toLocaleString('ru-RU')} ₽
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-muted-foreground">Нет доступных монтажных смет</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="total_amount">Сумма (₽)</Label>
                <Input
                  id="total_amount"
                  type="number"
                  step="0.01"
                  value={formData.total_amount}
                  onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="man_hours">Человек-часы</Label>
                <Input
                  id="man_hours"
                  type="number"
                  step="0.01"
                  value={formData.man_hours}
                  onChange={(e) => setFormData({ ...formData, man_hours: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Примечания</Label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="mt-1.5 w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Дополнительные примечания..."
              />
            </div>

            {conditions && conditions.length > 0 && (
              <div>
                <Label>Условия для МП</Label>
                <p className="text-sm text-muted-foreground mb-1">
                  Условия «по умолчанию» выбраны автоматически
                </p>
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border border-border rounded-lg p-3">
                  {conditions.map((condition: MountingCondition) => (
                    <label
                      key={condition.id}
                      className="flex items-start gap-2 cursor-pointer hover:bg-muted p-2 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selectedConditionIds.includes(condition.id)}
                        onChange={() => handleConditionToggle(condition.id)}
                        className="mt-1"
                      />
                      <div>
                        <div className="text-foreground">{condition.name}</div>
                        {condition.description && (
                          <div className="text-muted-foreground">{condition.description}</div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </form>

        <div className="p-6 border-t border-border flex justify-end gap-2">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="bg-muted text-foreground hover:bg-muted"
          >
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!formData.counterparty || createMutation.isPending}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {createMutation.isPending ? 'Создание...' : 'Создать МП'}
          </Button>
        </div>
      </div>
    </div>
  );
}
