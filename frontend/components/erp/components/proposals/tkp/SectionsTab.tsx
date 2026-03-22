import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  api,
  TechnicalProposalDetail as TKPDetail,
  TKPEstimateSubsection,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Pencil, Save, X } from 'lucide-react';
import { toast } from "sonner";
import { formatCurrency } from '@/lib/utils';

interface SectionsTabProps {
  tkp: TKPDetail;
}

export function SectionsTab({ tkp }: SectionsTabProps) {
  const queryClient = useQueryClient();
  const [expandedSections, setExpandedSections] = useState<number[]>([]);
  const [editingSubsectionId, setEditingSubsectionId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState({
    materials_sale: "",
    works_sale: "",
    materials_purchase: "",
    works_purchase: "",
  });

  // Обновление подраздела
  const updateSubsectionMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TKPEstimateSubsection> }) =>
      api.proposals.updateTKPSubsection(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technical-proposal", tkp.id.toString()] });
      toast.success("Подраздел обновлен");
      setEditingSubsectionId(null);
      setEditFormData({
        materials_sale: "",
        works_sale: "",
        materials_purchase: "",
        works_purchase: "",
      });
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  const toggleSection = (sectionId: number) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId],
    );
  };

  const handleEditSubsection = (subsection: TKPEstimateSubsection) => {
    setEditingSubsectionId(subsection.id);
    setEditFormData({
      materials_sale: subsection.materials_sale,
      works_sale: subsection.works_sale,
      materials_purchase: subsection.materials_purchase,
      works_purchase: subsection.works_purchase,
    });
  };

  const handleSaveSubsection = () => {
    if (editingSubsectionId) {
      updateSubsectionMutation.mutate({
        id: editingSubsectionId,
        data: editFormData,
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingSubsectionId(null);
    setEditFormData({
      materials_sale: "",
      works_sale: "",
      materials_purchase: "",
      works_purchase: "",
    });
  };

  // Рассчитываем общие итоги
  const totalSale = tkp.estimate_sections.reduce(
    (sum, section) => sum + parseFloat(section.total_sale || "0"),
    0,
  );
  const totalPurchase = tkp.estimate_sections.reduce(
    (sum, section) => sum + parseFloat(section.total_purchase || "0"),
    0,
  );
  const totalProfit = totalSale - totalPurchase;

  if (tkp.estimate_sections.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
        <div className="text-center text-gray-500">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p>Разделы не добавлены</p>
          <p className="mt-2">
            Добавьте сметы в ТКП, чтобы увидеть разделы
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-gray-900 mb-4">
          Разделы и подразделы ({tkp.estimate_sections.length})
        </h2>

        <div className="space-y-3">
          {tkp.estimate_sections.map((section) => (
            <div
              key={section.id}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              {/* Заголовок раздела */}
              <div
                className="bg-gray-50 p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => toggleSection(section.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-gray-900">{section.name}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-gray-600">
                        Продажа: {formatCurrency(section.total_sale)}
                      </div>
                      <div className="text-gray-600">
                        Закупка: {formatCurrency(section.total_purchase)}
                      </div>
                    </div>
                    <div className="text-green-700">
                      Прибыль:{" "}
                      {formatCurrency(
                        parseFloat(section.total_sale) - parseFloat(section.total_purchase),
                      )}
                    </div>
                    <div className="w-6 text-gray-400">
                      {expandedSections.includes(section.id) ? "▼" : "▶"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Подразделы */}
              {expandedSections.includes(section.id) && (
                <div className="p-4 bg-white">
                  {section.subsections && section.subsections.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-2 py-2 text-left text-gray-600">Подраздел</th>
                            <th className="px-2 py-2 text-right text-gray-600">Мат. продажа</th>
                            <th className="px-2 py-2 text-right text-gray-600">Работы продажа</th>
                            <th className="px-2 py-2 text-right text-gray-600">Мат. закупка</th>
                            <th className="px-2 py-2 text-right text-gray-600">Работы закупка</th>
                            <th className="px-2 py-2 text-right text-gray-600">Итого</th>
                            <th className="px-2 py-2 text-right text-gray-600">Прибыль</th>
                            <th className="px-2 py-2 text-right text-gray-600">Действия</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {section.subsections.map((subsection) => (
                            <tr key={subsection.id} className="hover:bg-gray-50">
                              <td className="px-2 py-2 text-gray-900">{subsection.name}</td>
                              {editingSubsectionId === subsection.id ? (
                                <>
                                  <td className="px-2 py-2">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={editFormData.materials_sale}
                                      onChange={(e) => setEditFormData({ ...editFormData, materials_sale: e.target.value })}
                                      className="w-28 text-right"
                                    />
                                  </td>
                                  <td className="px-2 py-2">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={editFormData.works_sale}
                                      onChange={(e) => setEditFormData({ ...editFormData, works_sale: e.target.value })}
                                      className="w-28 text-right"
                                    />
                                  </td>
                                  <td className="px-2 py-2">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={editFormData.materials_purchase}
                                      onChange={(e) => setEditFormData({ ...editFormData, materials_purchase: e.target.value })}
                                      className="w-28 text-right"
                                    />
                                  </td>
                                  <td className="px-2 py-2">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={editFormData.works_purchase}
                                      onChange={(e) => setEditFormData({ ...editFormData, works_purchase: e.target.value })}
                                      className="w-28 text-right"
                                    />
                                  </td>
                                  <td className="px-2 py-2 text-right text-gray-500">
                                    {formatCurrency(String(parseFloat(editFormData.materials_sale || '0') + parseFloat(editFormData.works_sale || '0')))}
                                  </td>
                                  <td className="px-2 py-2 text-right text-gray-500">
                                    {formatCurrency(String(
                                      (parseFloat(editFormData.materials_sale || '0') + parseFloat(editFormData.works_sale || '0')) -
                                      (parseFloat(editFormData.materials_purchase || '0') + parseFloat(editFormData.works_purchase || '0'))
                                    ))}
                                  </td>
                                  <td className="px-2 py-2 text-right flex gap-1">
                                    <Button
                                      onClick={handleSaveSubsection}
                                      disabled={updateSubsectionMutation.isPending}
                                      className="bg-green-600 text-white hover:bg-green-700 px-2 py-1"
                                    >
                                      <Save className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      onClick={handleCancelEdit}
                                      className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-2 py-1"
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="px-2 py-2 text-right text-gray-900">
                                    {formatCurrency(subsection.materials_sale)}
                                  </td>
                                  <td className="px-2 py-2 text-right text-gray-900">
                                    {formatCurrency(subsection.works_sale)}
                                  </td>
                                  <td className="px-2 py-2 text-right text-gray-900">
                                    {formatCurrency(subsection.materials_purchase)}
                                  </td>
                                  <td className="px-2 py-2 text-right text-gray-900">
                                    {formatCurrency(subsection.works_purchase)}
                                  </td>
                                  <td className="px-2 py-2 text-right text-gray-900">
                                    {formatCurrency(subsection.total_sale)}
                                  </td>
                                  <td className="px-2 py-2 text-right text-green-700">
                                    {formatCurrency(
                                      parseFloat(subsection.total_sale) - parseFloat(subsection.total_purchase),
                                    )}
                                  </td>
                                  <td className="px-2 py-2 text-right">
                                    <Button
                                      onClick={() => handleEditSubsection(subsection)}
                                      className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-2 py-1"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-4">
                      Подразделы не найдены
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Общая сводка */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-gray-900 mb-4">Общая сводка</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-gray-600 mb-1">Итого продажа</div>
            <div className="text-blue-900">{formatCurrency(totalSale)}</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <div className="text-gray-600 mb-1">Итого закупка</div>
            <div className="text-red-900">{formatCurrency(totalPurchase)}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-gray-600 mb-1">Итого прибыль</div>
            <div className="text-green-900">{formatCurrency(totalProfit)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
