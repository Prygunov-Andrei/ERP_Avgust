import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  api,
  unwrapResults,
  TechnicalProposalDetail as TKPDetail,
  EstimateList,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { FileText, Plus, X, Copy } from 'lucide-react';
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
import { CONSTANTS } from '@/constants';

interface EstimatesTabProps {
  tkp: TKPDetail;
}

export function EstimatesTab({ tkp }: EstimatesTabProps) {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedEstimates, setSelectedEstimates] = useState<number[]>([]);
  const [copyData, setCopyData] = useState(true);
  const [removeTarget, setRemoveTarget] = useState<{ id: number; name: string } | null>(null);
  const [isCopyDataDialogOpen, setIsCopyDataDialogOpen] = useState(false);

  // Загрузка смет объекта
  const { data: allEstimates } = useQuery({
    queryKey: ["estimates", { object: tkp.object }],
    queryFn: () => api.estimates.getEstimates({ object: tkp.object }),
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
  });

  // Добавление смет
  const addEstimatesMutation = useMutation({
    mutationFn: (data: { estimateIds: number[]; copyData: boolean }) =>
      api.proposals.addEstimatesToTKP(tkp.id, data.estimateIds, data.copyData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technical-proposal", tkp.id.toString()] });
      toast.success("Сметы добавлены в ТКП");
      setIsAddDialogOpen(false);
      setSelectedEstimates([]);
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  // Удаление смет
  const removeEstimatesMutation = useMutation({
    mutationFn: (estimateIds: number[]) =>
      api.proposals.removeEstimatesFromTKP(tkp.id, estimateIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technical-proposal", tkp.id.toString()] });
      toast.success("Смета удалена из ТКП");
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  // Копирование данных из смет
  const copyDataMutation = useMutation({
    mutationFn: () => api.proposals.copyDataFromEstimates(tkp.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technical-proposal", tkp.id.toString()] });
      queryClient.invalidateQueries({ queryKey: ["tkp-characteristics", tkp.id.toString()] });
      queryClient.invalidateQueries({ queryKey: ["tkp-front-of-work", tkp.id.toString()] });
      toast.success("Данные скопированы из смет");
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  const handleAddEstimates = () => {
    if (selectedEstimates.length === 0) {
      toast.error("Выберите хотя бы одну смету");
      return;
    }
    addEstimatesMutation.mutate({ estimateIds: selectedEstimates, copyData });
  };

  const handleRemoveEstimate = (estimateId: number, estimateName: string) => {
    setRemoveTarget({ id: estimateId, name: estimateName });
  };

  const handleConfirmRemove = () => {
    if (removeTarget) {
      removeEstimatesMutation.mutate([removeTarget.id]);
      setRemoveTarget(null);
    }
  };

  const handleCopyData = () => {
    setIsCopyDataDialogOpen(true);
  };

  const handleConfirmCopyData = () => {
    copyDataMutation.mutate();
    setIsCopyDataDialogOpen(false);
  };

  // Получаем ID смет, которые уже добавлены
  const addedEstimateIds = tkp.estimate_sections.map((section) => section.source_estimate);

  // Фильтруем доступные для добавления сметы
  const availableEstimates =
    unwrapResults(allEstimates).filter(
      (est: EstimateList) => !addedEstimateIds.includes(est.id),
    );

  const renderAddEstimatesDialog = () => (
    isAddDialogOpen && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-gray-900">Добавить сметы в ТКП</h2>
          </div>
          <div className="p-6 overflow-y-auto max-h-96">
            {availableEstimates.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                Нет доступных смет для добавления
              </div>
            ) : (
              <div className="space-y-2">
                {availableEstimates.map((estimate: { id: number; number?: string; name?: string; object_name?: string; project_name?: string; total_sale?: string }) => (
                  <label
                    key={estimate.id}
                    className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEstimates.includes(estimate.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEstimates([...selectedEstimates, estimate.id]);
                        } else {
                          setSelectedEstimates(selectedEstimates.filter((id) => id !== estimate.id));
                        }
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="text-gray-900">{estimate.name}</div>
                      <div className="text-gray-500">Проект: {estimate.project_name}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={copyData}
                  onChange={(e) => setCopyData(e.target.checked)}
                />
                <span className="text-gray-700">
                  Автоматически скопировать характеристики и фронт работ из смет
                </span>
              </label>
            </div>
          </div>
          <div className="p-6 border-t border-gray-200 flex justify-end gap-2">
            <Button
              onClick={() => {
                setIsAddDialogOpen(false);
                setSelectedEstimates([]);
              }}
              className="bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              Отмена
            </Button>
            <Button
              onClick={handleAddEstimates}
              disabled={selectedEstimates.length === 0 || addEstimatesMutation.isPending}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              Добавить ({selectedEstimates.length})
            </Button>
          </div>
        </div>
      </div>
    )
  );

  if (tkp.estimates.length === 0 && tkp.estimate_sections.length === 0) {
    return (
      <>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
          <div className="text-center text-gray-500">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p>Сметы не добавлены</p>
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              className="mt-4 bg-blue-600 text-white hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить сметы
            </Button>
          </div>
        </div>
        {renderAddEstimatesDialog()}
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-gray-900">
              Сметы в ТКП ({tkp.estimates.length})
            </h2>
            <div className="flex gap-2">
              <Button
                onClick={handleCopyData}
                className="bg-purple-600 text-white hover:bg-purple-700"
                title="Скопировать характеристики и фронт работ из связанных смет"
              >
                <Copy className="w-4 h-4 mr-2" />
                Обновить данные из смет
              </Button>
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Добавить сметы
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {(() => {
              const grouped = new Map<number | null, typeof tkp.estimate_sections>();
              tkp.estimate_sections.forEach((section) => {
                const key = section.source_estimate;
                if (!grouped.has(key)) grouped.set(key, []);
                grouped.get(key)!.push(section);
              });
              return Array.from(grouped.entries()).map(([estimateId, sections]) => {
                const estimateName = sections[0]?.estimate_name || sections[0]?.name || 'Смета';
                const totalSale = sections.reduce((s, sec) => s + parseFloat(sec.total_sale || '0'), 0);
                const totalPurchase = sections.reduce((s, sec) => s + parseFloat(sec.total_purchase || '0'), 0);
                const totalProfit = totalSale - totalPurchase;
                return (
                  <div
                    key={estimateId ?? 'unknown'}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-gray-900">{estimateName}</h3>
                        <p className="text-sm text-gray-500">{sections.length} {sections.length === 1 ? 'раздел' : sections.length < 5 ? 'раздела' : 'разделов'}</p>
                      </div>
                      <Button
                        onClick={() => handleRemoveEstimate(estimateId || sections[0]?.id, estimateName)}
                        className="bg-red-100 text-red-700 hover:bg-red-200"
                        title="Удалить смету из ТКП"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="space-y-1 mb-3">
                      {sections.map((section) => (
                        <div key={section.id} className="flex items-center justify-between text-sm py-1 px-2 bg-gray-50 rounded">
                          <span className="text-gray-700">{section.name}</span>
                          <span className="text-gray-600">{formatCurrency(section.total_sale)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-4 pt-3 border-t border-gray-100">
                      <div>
                        <div className="text-gray-600">Продажа</div>
                        <div className="text-gray-900">{formatCurrency(String(totalSale))}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Закупка</div>
                        <div className="text-gray-900">{formatCurrency(String(totalPurchase))}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Прибыль</div>
                        <div className="text-green-700">{formatCurrency(String(totalProfit))}</div>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {renderAddEstimatesDialog()}

      {/* Диалог подтверждения удаления сметы */}
      <AlertDialog open={!!removeTarget} onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удаление сметы из ТКП</AlertDialogTitle>
            <AlertDialogDescription>
              Удалить смету «{removeTarget?.name}» из ТКП?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRemove} className="bg-red-600 hover:bg-red-700">Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Диалог подтверждения копирования данных */}
      <AlertDialog open={isCopyDataDialogOpen} onOpenChange={setIsCopyDataDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Обновление данных из смет</AlertDialogTitle>
            <AlertDialogDescription>
              Скопировать характеристики и фронт работ из связанных смет? Это обновит данные в ТКП.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCopyData}>Подтвердить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
