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
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Артикул</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Раздел</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Наименование</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Ед.изм.</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Часы</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Разряд</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Коэфф.</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Стоимость</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Включена</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length > 0 ? (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted">
                    <td className="px-6 py-4"><span className="text-xs font-mono text-foreground">{item.work_item_detail.article}</span></td>
                    <td className="px-6 py-4"><span className="text-sm text-foreground">{item.work_item_detail.section_name}</span></td>
                    <td className="px-6 py-4"><span className="text-sm text-foreground">{item.work_item_detail.name}</span></td>
                    <td className="px-6 py-4"><span className="text-sm text-muted-foreground">{item.work_item_detail.unit}</span></td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-foreground">
                        {item.effective_hours}
                        {item.hours_override && (<span className="text-xs text-primary ml-1">*</span>)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <TooltipProvider>
                        {getGradeTooltip(item.effective_grade) ? (
                          <Tooltip>
                            <TooltipTrigger className="cursor-help">
                              <span className="text-sm text-foreground inline-flex items-center gap-1">
                                {formatGrade(item.effective_grade)}
                                {item.grade_override && (<span className="text-xs text-primary">*</span>)}
                                <Info className="w-3 h-3 text-muted-foreground" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent><p className="text-xs">{getGradeTooltip(item.effective_grade)}</p></TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-sm text-foreground">
                            {formatGrade(item.effective_grade)}
                            {item.grade_override && (<span className="text-xs text-primary ml-1">*</span>)}
                          </span>
                        )}
                      </TooltipProvider>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-foreground">
                        {item.effective_coefficient}
                        {item.coefficient_override && (<span className="text-xs text-primary ml-1">*</span>)}
                      </span>
                    </td>
                    <td className="px-6 py-4"><span className="text-sm font-medium text-foreground">{formatCurrency(item.calculated_cost)}</span></td>
                    <td className="px-6 py-4">
                      {item.is_included ? (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-md bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Да</span>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-md bg-muted text-foreground">Нет</span>
                      )}
                    </td>
                    <td className="px-6 py-4"><Button variant="ghost" size="sm" onClick={() => onEditItem(item)}><Edit2 className="w-4 h-4" /></Button></td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={10} className="px-6 py-12 text-center text-muted-foreground">Нет позиций в прайс-листе</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold text-foreground">Итого (включенные позиции):</span>
          <span className="text-2xl font-semibold text-foreground">{formatCurrency(getTotalIncluded())}</span>
        </div>
      </div>
    </div>
  );
}
