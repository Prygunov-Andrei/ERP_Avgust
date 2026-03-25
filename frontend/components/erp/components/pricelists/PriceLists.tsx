import { useState } from 'react';
import { useNavigate } from '@/hooks/erp-router';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, FileText, Calendar } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { usePriceLists } from '@/hooks';

export function PriceLists() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: priceLists, isLoading } = usePriceLists();

  const getStatusBadge = (status: string, statusDisplay: string) => {
    const badges = {
      draft: 'bg-muted text-foreground',
      active: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
      archived: 'bg-muted text-muted-foreground',
    };
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-md ${badges[status as keyof typeof badges] || badges.draft}`}>
        {statusDisplay}
      </span>
    );
  };

  // Фильтрация
  const filteredLists = priceLists?.filter((list) => {
    if (statusFilter === 'all') return true;
    return list.status === statusFilter;
  });

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Прайс-листы</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Управление прайс-листами и ставками
          </p>
        </div>
        <Button
          onClick={() => navigate('/price-lists/create')}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Создать прайс-лист
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 max-w-xs">
            <label htmlFor="statusFilter" className="text-sm font-medium text-foreground">
              Статус
            </label>
            <select
              id="statusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1.5 w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Все</option>
              <option value="draft">Черновик</option>
              <option value="active">Действующий</option>
              <option value="archived">Архивный</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted border-b border-border">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Номер
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Название
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Дата
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Статус
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Версия
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Работ
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Согласований
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12">
                  <div className="flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                  </div>
                </td>
              </tr>
            ) : filteredLists && filteredLists.length > 0 ? (
              filteredLists.map((list) => (
                <tr
                  key={list.id}
                  onClick={() => navigate(`/price-lists/${list.id}`)}
                  className="hover:bg-muted cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium text-foreground">{list.number}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-foreground">{list.name || '—'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      {formatDate(list.date)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(list.status, list.status_display)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-foreground">v{list.version_number}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-foreground">{list.items_count}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-foreground">{list.agreements_count}</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Прайс-листы не найдены</p>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/price-lists/create')}
                    className="mt-4"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Создать первый прайс-лист
                  </Button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
