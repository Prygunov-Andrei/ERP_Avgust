import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@/hooks/erp-router';
import { Plus, Search, Filter, X } from 'lucide-react';
import { api, unwrapResults, Act } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { formatDate, formatAmount, formatCurrency } from '@/lib/utils';
import { CONSTANTS } from '@/constants';

export function ActsList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string | undefined>>({});
  const [showFilters, setShowFilters] = useState(false);

  // Загрузка актов
  const { data: actsData, isLoading } = useQuery({
    queryKey: ['acts', { ...filters, search }],
    queryFn: () => api.contracts.getActs({ ...filters, search }),
    staleTime: CONSTANTS.REFERENCE_STALE_TIME_MS,
  });

  // Загрузка договоров для фильтров
  const { data: contracts } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => api.contracts.getContracts(),
    staleTime: CONSTANTS.REFERENCE_STALE_TIME_MS,
  });

  const getStatusBadge = (status: string) => {
    const config = {
      draft: { label: 'Черновик', className: 'bg-muted text-foreground' },
      agreed: { label: 'Согласован', className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 dark:text-yellow-400' },
      signed: { label: 'Подписан', className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' },
      cancelled: { label: 'Отменен', className: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400' },
    };
    const item = config[status as keyof typeof config] || config.draft;
    return <Badge className={item.className}>{item.label}</Badge>;
  };

  const isOverdue = (act: Act) => {
    if (!act.due_date || act.status !== 'signed' || parseFloat(act.unpaid_amount || '0') <= 0) {
      return false;
    }
    const dueDate = new Date(act.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  };

  const handleResetFilters = () => {
    setFilters({});
    setSearch('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  const acts = unwrapResults(actsData);

  return (
    <div className="space-y-6">
      {/* Хедер */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground">Акты выполненных работ</h1>
          <p className="text-muted-foreground">Управление актами выполненных работ по договорам</p>
        </div>
        <Button
          onClick={() => navigate('/contracts/acts/create')}
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Создать акт
        </Button>
      </div>

      {/* Поиск и фильтры */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-4 space-y-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              placeholder="Поиск по номеру и описанию..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? 'bg-primary/10' : ''}
          >
            <Filter className="w-4 h-4 mr-2" />
            Фильтры
          </Button>
          {(Object.keys(filters).length > 0 || search) && (
            <Button variant="outline" onClick={handleResetFilters}>
              <X className="w-4 h-4 mr-2" />
              Сбросить
            </Button>
          )}
        </div>

        {/* Панель фильтров */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <Label>Договор</Label>
              <select
                value={filters.contract || ''}
                onChange={(e) => setFilters({ ...filters, contract: e.target.value || undefined })}
                className="w-full px-3 py-2 border rounded-md mt-1"
              >
                <option value="">Все договоры</option>
                {contracts?.results.map((contract) => (
                  <option key={contract.id} value={contract.id}>
                    {contract.number} - {contract.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Статус</Label>
              <select
                value={filters.status || ''}
                onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
                className="w-full px-3 py-2 border rounded-md mt-1"
              >
                <option value="">Все</option>
                <option value="draft">Черновик</option>
                <option value="agreed">Согласован</option>
                <option value="signed">Подписан</option>
                <option value="cancelled">Отменен</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Таблица актов */}
      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        {acts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Акты не найдены
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-muted-foreground">Номер</th>
                  <th className="px-6 py-3 text-left text-muted-foreground">Договор</th>
                  <th className="px-6 py-3 text-left text-muted-foreground">Дата</th>
                  <th className="px-6 py-3 text-left text-muted-foreground">Срок оплаты</th>
                  <th className="px-6 py-3 text-left text-muted-foreground">Период работ</th>
                  <th className="px-6 py-3 text-left text-muted-foreground">Сумма с НДС</th>
                  <th className="px-6 py-3 text-left text-muted-foreground">Сумма без НДС</th>
                  <th className="px-6 py-3 text-left text-muted-foreground">НДС</th>
                  <th className="px-6 py-3 text-left text-muted-foreground">Статус</th>
                  <th className="px-6 py-3 text-left text-muted-foreground">Неоплачено</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {acts.map((act) => {
                  const overdue = isOverdue(act);
                  return (
                    <tr
                      key={act.id}
                      onClick={() => navigate(`/contracts/acts/${act.id}`)}
                      className={`hover:bg-muted cursor-pointer transition-colors ${
                        overdue ? 'border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20' : ''
                      }`}
                    >
                      <td className="px-6 py-4 text-foreground">{act.number}</td>
                      <td className="px-6 py-4 text-muted-foreground">{act.contract_number}</td>
                      <td className="px-6 py-4 text-muted-foreground">{formatDate(act.date)}</td>
                      <td className="px-6 py-4">
                        {act.due_date ? (
                          <div className="flex items-center gap-2">
                            <span className={overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                              {formatDate(act.due_date)}
                            </span>
                            {overdue && (
                              <Badge className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">Просрочен</Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {act.period_start && act.period_end
                          ? `${formatDate(act.period_start)} - ${formatDate(act.period_end)}`
                          : '-'}
                      </td>
                      <td className="px-6 py-4 text-foreground">{formatCurrency(act.amount_gross)}</td>
                      <td className="px-6 py-4 text-muted-foreground">{formatCurrency(act.amount_net)}</td>
                      <td className="px-6 py-4 text-muted-foreground">{formatCurrency(act.vat_amount)}</td>
                      <td className="px-6 py-4">{getStatusBadge(act.status)}</td>
                      <td className="px-6 py-4">
                        {parseFloat(act.unpaid_amount || '0') > 0 ? (
                          <span className="text-red-600">{formatCurrency(act.unpaid_amount)}</span>
                        ) : (
                          <span className="text-green-600">Оплачено</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Счетчик */}
      <div className="text-muted-foreground">
        Всего актов: {acts.length}
      </div>
    </div>
  );
}