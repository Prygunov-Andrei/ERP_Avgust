import { PriceListItem } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Edit2, Info } from 'lucide-react';

interface PriceListItemsTabProps {
  items: PriceListItem[];
  onEditItem: (item: PriceListItem) => void;
  getTotalIncluded: () => string;
}

const formatGrade = (gradeValue: string): string => {
  const gradeNum = parseFloat(gradeValue);
  if (isNaN(gradeNum)) return '-';
  if (Number.isInteger(gradeNum)) return gradeNum.toString();
  return gradeNum.toFixed(2).replace(/\.?0+$/, '');
};

const getGradeTooltip = (gradeValue: string): string | null => {
  const gradeNum = parseFloat(gradeValue);
  if (gradeNum % 1 === 0) return null;
  const lowerGrade = Math.floor(gradeNum);
  const upperGrade = Math.ceil(gradeNum);
  const weight = gradeNum - lowerGrade;
  if (weight === 0.5) return `Средний разряд между ${lowerGrade} и ${upperGrade}`;
  return `Взвешенный разряд: ${lowerGrade} (${((1 - weight) * 100).toFixed(0)}%) + ${upperGrade} (${(weight * 100).toFixed(0)}%)`;
};

export function PriceListItemsTab({ items, onEditItem, getTotalIncluded }: PriceListItemsTabProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Артикул</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Раздел</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Наименование</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ед.изм.</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Часы</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Разряд</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Коэфф.</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Стоимость</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Включена</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.length > 0 ? (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4"><span className="text-xs font-mono text-gray-700">{item.work_item_detail.article}</span></td>
                    <td className="px-6 py-4"><span className="text-sm text-gray-900">{item.work_item_detail.section_name}</span></td>
                    <td className="px-6 py-4"><span className="text-sm text-gray-900">{item.work_item_detail.name}</span></td>
                    <td className="px-6 py-4"><span className="text-sm text-gray-600">{item.work_item_detail.unit}</span></td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">
                        {item.effective_hours}
                        {item.hours_override && (<span className="text-xs text-blue-600 ml-1">*</span>)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <TooltipProvider>
                        {getGradeTooltip(item.effective_grade) ? (
                          <Tooltip>
                            <TooltipTrigger className="cursor-help">
                              <span className="text-sm text-gray-900 inline-flex items-center gap-1">
                                {formatGrade(item.effective_grade)}
                                {item.grade_override && (<span className="text-xs text-blue-600">*</span>)}
                                <Info className="w-3 h-3 text-gray-400" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent><p className="text-xs">{getGradeTooltip(item.effective_grade)}</p></TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-sm text-gray-900">
                            {formatGrade(item.effective_grade)}
                            {item.grade_override && (<span className="text-xs text-blue-600 ml-1">*</span>)}
                          </span>
                        )}
                      </TooltipProvider>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">
                        {item.effective_coefficient}
                        {item.coefficient_override && (<span className="text-xs text-blue-600 ml-1">*</span>)}
                      </span>
                    </td>
                    <td className="px-6 py-4"><span className="text-sm font-medium text-gray-900">{formatCurrency(item.calculated_cost)}</span></td>
                    <td className="px-6 py-4">
                      {item.is_included ? (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-md bg-green-100 text-green-700">Да</span>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-md bg-gray-100 text-gray-700">Нет</span>
                      )}
                    </td>
                    <td className="px-6 py-4"><Button variant="ghost" size="sm" onClick={() => onEditItem(item)}><Edit2 className="w-4 h-4" /></Button></td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={10} className="px-6 py-12 text-center text-gray-500">Нет позиций в прайс-листе</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold text-gray-900">Итого (включенные позиции):</span>
          <span className="text-2xl font-semibold text-gray-900">{formatCurrency(getTotalIncluded())}</span>
        </div>
      </div>
    </div>
  );
}
