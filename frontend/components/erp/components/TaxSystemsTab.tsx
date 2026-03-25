import { TaxSystem } from '@/lib/api';
import { Loader2, ScrollText, Check, X } from 'lucide-react';
import { useTaxSystems } from '@/hooks';

export function TaxSystemsTab() {
  const { data: taxSystems, isLoading, error } = useTaxSystems();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl">
        Ошибка загрузки: {(error as Error).message}
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Налоговые системы</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Справочник систем налогообложения (только для чтения)
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {taxSystems?.length || 0} {taxSystems?.length === 1 ? 'система' : 'систем'}
        </div>
      </div>

      {!taxSystems || taxSystems.length === 0 ? (
        <div className="bg-muted border-2 border-dashed border-border rounded-xl p-12 text-center">
          <ScrollText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Нет систем налогообложения</p>
          <p className="text-sm text-muted-foreground mt-2">
            Справочник заполняется на бэкенде
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Код
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Название
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Ставка НДС
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Есть НДС
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Активна
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {taxSystems.map((system: TaxSystem) => (
                  <tr key={system.id} className="hover:bg-muted transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono text-foreground">
                        {system.code || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-foreground">{system.name}</div>
                      {system.description && (
                        <div className="text-xs text-muted-foreground mt-1">{system.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm text-foreground">
                        {system.vat_rate ? `${parseFloat(system.vat_rate)}%` : '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {system.has_vat ? (
                        <Check className="w-5 h-5 text-green-600 mx-auto" />
                      ) : (
                        <X className="w-5 h-5 text-muted-foreground mx-auto" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {system.is_active ? (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                          Активна
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-muted text-muted-foreground rounded">
                          Неактивна
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
