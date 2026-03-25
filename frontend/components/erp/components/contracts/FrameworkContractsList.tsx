import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@/hooks/erp-router';
import { Plus, Search, Filter, X, CheckCircle, XCircle } from 'lucide-react';
import { api , unwrapResults} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { formatDate, formatAmount, formatCurrency } from '@/lib/utils';
import { CONSTANTS } from '@/constants';
import { useCounterparties, useLegalEntities } from '@/hooks';

export function FrameworkContractsList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string | undefined>>({});
  const [showFilters, setShowFilters] = useState(false);

  // Загрузка рамочных договоров
  const { data: contractsData, isLoading } = useQuery({
    queryKey: ['framework-contracts', { ...filters, search }],
    queryFn: () => api.contracts.getFrameworkContracts({ ...filters, search }),
    staleTime: CONSTANTS.REFERENCE_STALE_TIME_MS,
  });

  // Загрузка справочников для фильтров с кешированием
  const { data: counterpartiesData } = useCounterparties();
  const { data: legalEntitiesData } = useLegalEntities();

  // Извлекаем массивы из ответов API
  const counterparties = unwrapResults(counterpartiesData);
  const legalEntities = unwrapResults(legalEntitiesData);

  const getStatusBadge = (status: string, isActive: boolean) => {
    if (status === 'draft') {
      return <Badge className="bg-muted text-foreground">Черновик</Badge>;
    } else if (status === 'active') {
      return isActive ? (
        <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">Действующий</Badge>
      ) : (
        <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400">Неактивный</Badge>
      );
    } else if (status === 'expired') {
      return <Badge className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400 dark:text-orange-400">Истёк срок</Badge>;
    } else if (status === 'terminated') {
      return <Badge className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">Расторгнут</Badge>;
    }
    return <Badge className="bg-muted text-foreground">{status}</Badge>;
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

  const contracts = contractsData?.results || [];

  return (
    <div className="space-y-6">
      {/* Хедер */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground">Рамочные договоры</h1>
          <p className="text-muted-foreground">Управление рамочными договорами с поставщиками</p>
        </div>
        <Button
          onClick={() => navigate('/contracts/framework-contracts/create')}
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Создать рамочный договор
        </Button>
      </div>

      {/* Поиск и фильтры */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-4 space-y-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              placeholder="Поиск по номеру и названию..."
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
            <div>
              <Label>Статус</Label>
              <select
                value={filters.status || ''}
                onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
                className="w-full px-3 py-2 border rounded-md mt-1"
              >
                <option value="">Все</option>
                <option value="draft">Черновик</option>
                <option value="active">Действующий</option>
                <option value="expired">Истёк срок</option>
                <option value="terminated">Расторгнут</option>
              </select>
            </div>
            <div>
              <Label>Исполнитель</Label>
              <select
                value={filters.counterparty || ''}
                onChange={(e) => setFilters({ ...filters, counterparty: e.target.value || undefined })}
                className="w-full px-3 py-2 border rounded-md mt-1"
              >
                <option value="">Все исполнители</option>
                {counterparties.map((cp) => (
                  <option key={cp.id} value={cp.id}>{cp.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Наша компания</Label>
              <select
                value={filters.legal_entity || ''}
                onChange={(e) => setFilters({ ...filters, legal_entity: e.target.value || undefined })}
                className="w-full px-3 py-2 border rounded-md mt-1"
              >
                <option value="">Все компании</option>
                {legalEntities.map((le) => (
                  <option key={le.id} value={le.id}>{le.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Таблица рамочных договоров */}
      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        {contracts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Рамочные договоры не найдены
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-muted-foreground">Номер</th>
                  <th className="px-6 py-3 text-left text-muted-foreground">Название</th>
                  <th className="px-6 py-3 text-left text-muted-foreground">Исполнитель</th>
                  <th className="px-6 py-3 text-left text-muted-foreground">Компания</th>
                  <th className="px-6 py-3 text-left text-muted-foreground">Дата заключения</th>
                  <th className="px-6 py-3 text-left text-muted-foreground">Срок действия</th>
                  <th className="px-6 py-3 text-left text-muted-foreground">Статус</th>
                  <th className="px-6 py-3 text-left text-muted-foreground">Активен</th>
                  <th className="px-6 py-3 text-left text-muted-foreground">Договоров</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contracts.map((contract) => (
                  <tr
                    key={contract.id}
                    onClick={() => navigate(`/contracts/framework-contracts/${contract.id}`)}
                    className="hover:bg-muted cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 text-foreground">{contract.number}</td>
                    <td className="px-6 py-4 text-foreground">{contract.name}</td>
                    <td className="px-6 py-4 text-muted-foreground">{contract.counterparty_name}</td>
                    <td className="px-6 py-4 text-muted-foreground">{contract.legal_entity_name}</td>
                    <td className="px-6 py-4 text-muted-foreground">{formatDate(contract.date)}</td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {formatDate(contract.valid_from)} - {formatDate(contract.valid_until)}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(contract.status, contract.is_active)}</td>
                    <td className="px-6 py-4">
                      {contract.is_active ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-muted-foreground" />
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-900">
                        {contract.contracts_count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Счетчик */}
      <div className="text-muted-foreground">
        Всего рамочных договоров: {contractsData?.count || 0}
      </div>
    </div>
  );
}