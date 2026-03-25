import { EstimateCharacteristic } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Plus, Edit2, Trash2, DollarSign } from 'lucide-react';

interface EstimateCharacteristicsTabProps {
  characteristics: EstimateCharacteristic[];
  onAdd: () => void;
  onEdit: (char: EstimateCharacteristic) => void;
  onDelete: (charId: number, isAuto: boolean) => void;
}

export function EstimateCharacteristicsTab({
  characteristics,
  onAdd,
  onEdit,
  onDelete,
}: EstimateCharacteristicsTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={onAdd} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Добавить характеристику
        </Button>
      </div>

      {characteristics.length > 0 ? (
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Название</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Закупка</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Продажа</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Источник</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {characteristics.map((char) => (
                <tr key={char.id} className={char.is_auto_calculated ? 'bg-green-50 dark:bg-green-900/20' : ''}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{char.name}</span>
                      {char.is_auto_calculated && (
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-md bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                          Авто
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-foreground">{formatCurrency(char.purchase_amount)}</td>
                  <td className="px-6 py-4 text-right font-medium text-foreground">{formatCurrency(char.sale_amount)}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{char.source_type_display}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(char)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      {!char.is_auto_calculated && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(char.id, char.is_auto_calculated)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-sm border border-border p-12 text-center">
          <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Нет характеристик</p>
        </div>
      )}
    </div>
  );
}
