import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export function FNSIntegrationTab() {
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading, error: statsError, refetch } = useQuery({
    queryKey: ['fns-stats'],
    queryFn: () => api.core.fnsGetStats(),
    staleTime: 5 * 60_000,
  });

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (statsError) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-xl">
        Ошибка загрузки статистики: {(statsError as Error).message}
      </div>
    );
  }

  if (!stats?.is_configured) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">API-FNS не настроен</h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Для проверки контрагентов через ФНС добавьте переменную окружения <code className="bg-gray-100 px-1 rounded">FNS_API_KEY</code> в настройки сервера.
        </p>
      </div>
    );
  }

  const statusColor = stats.status === 'VIP' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600';

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">API-FNS (api-fns.ru)</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['fns-stats'] });
              refetch();
              toast.success('Статистика обновлена');
            }}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Обновить
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">Статус ключа</div>
            <span className={`px-2 py-0.5 text-sm font-medium rounded ${statusColor}`}>
              {stats.status}
            </span>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">Дата начала</div>
            <div className="text-sm font-medium">{stats.start_date || '—'}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">Дата окончания</div>
            <div className="text-sm font-medium">{stats.end_date || '—'}</div>
          </div>
        </div>

        {stats.methods.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Метод</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase w-24">Лимит</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase w-28">Использовано</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase w-24">Остаток</th>
                  <th className="py-2 px-3 text-xs font-medium text-gray-500 uppercase w-48">Прогресс</th>
                </tr>
              </thead>
              <tbody>
                {stats.methods.map((method) => {
                  const usagePercent = method.limit > 0 ? (method.used / method.limit) * 100 : 0;
                  const barColor = usagePercent < 50 ? 'bg-green-500'
                    : usagePercent < 90 ? 'bg-yellow-500'
                    : 'bg-red-500';

                  return (
                    <tr key={method.name} className="border-b border-gray-100 last:border-0">
                      <td className="py-2.5 px-3">
                        <div className="text-sm font-medium">{method.display_name}</div>
                        <div className="text-xs text-gray-400">{method.name}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right text-sm font-mono">{method.limit}</td>
                      <td className="py-2.5 px-3 text-right text-sm font-mono">{method.used}</td>
                      <td className="py-2.5 px-3 text-right text-sm font-mono font-medium">
                        {method.remaining}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${barColor}`}
                              style={{ width: `${Math.min(usagePercent, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 w-10 text-right">
                            {Math.round(usagePercent)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Нет данных о лимитах</p>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-3">Возможности интеграции</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="font-medium text-blue-700 mb-1">Автозаполнение</div>
            <div className="text-blue-600 text-xs">При создании контрагента — автоподстановка реквизитов по ИНН или названию</div>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg">
            <div className="font-medium text-purple-700 mb-1">Проверка контрагента</div>
            <div className="text-purple-600 text-xs">Позитивные и негативные факторы: массовый адрес, дисквалификация, блокировки</div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <div className="font-medium text-green-700 mb-1">Данные ЕГРЮЛ</div>
            <div className="text-green-600 text-xs">Полная выписка: директор, учредители, ОКВЭД, капитал, история изменений</div>
          </div>
          <div className="p-3 bg-orange-50 rounded-lg">
            <div className="font-medium text-orange-700 mb-1">Бухгалтерская отчетность</div>
            <div className="text-orange-600 text-xs">Баланс, P&L, выручка и прибыль по годам (с 2019 года)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
