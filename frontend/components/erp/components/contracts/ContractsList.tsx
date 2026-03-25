import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@/hooks/erp-router';
import { Plus, Search, Filter, X } from 'lucide-react';
import { api, ContractListItem , unwrapResults} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CreateContractDialog } from '../CreateContractDialog';
import { useObjects, useCounterparties, useLegalEntities } from '@/hooks';
import { formatDate, formatAmount, formatCurrency } from '@/lib/utils';
import { CONSTANTS } from '@/constants';

export function ContractsList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string | undefined>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Загрузка договоров
  const { data: contractsData, isLoading } = useQuery({
    queryKey: ['contracts', { ...filters, search }],
    queryFn: () => api.contracts.getContracts({ ...filters, search }),
    staleTime: CONSTANTS.REFERENCE_STALE_TIME_MS,
  });

  // Извлекаем массив contracts из ответа API
  const contracts = unwrapResults(contractsData);

  // Загрузка справочников для фильтров с кешированием
  const { data: objectsData } = useObjects();
  const { data: counterpartiesData } = useCounterparties();
  const { data: legalEntitiesData } = useLegalEntities();

  // Извлекаем массивы из ответов API
  const objects = objectsData || [];
  const counterparties = counterpartiesData || [];
  const legalEntities = legalEntitiesData || [];

  const getStatusBadge = (status: string) => {
    const config = {
      planned: { label: 'Планируется', className: 'bg-muted text-foreground' },
      active: { label: 'В работе', className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' },
      completed: { label: 'Завершён', className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400' },
      suspended: { label: 'Приостановлен', className: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400 dark:text-orange-400' },
      terminated: { label: 'Расторгнут', className: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400' },
    };
    const item = config[status as keyof typeof config] || config.planned;
    return <Badge className={item.className}>{item.label}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    return type === 'income' ? (
      <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">Доходный</Badge>
    ) : (
      <Badge className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">Расходный</Badge>
    );
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

  return (
    <div className="space-y-6">
      {/* Хедер */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground">Договоры</h1>
          <p className="text-muted-foreground">Управление доходными и расходными договорами</p>
        </div>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Создать договор
        </Button>
      </div>

      {/* Поиск и фильтры */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-4 space-y-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              placeholder="Поиск по номеру, названию, контрагенту, объекту..."
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
              <Label>Тип</Label>
              <select
                value={filters.contract_type || ''}
                onChange={(e) => setFilters({ ...filters, contract_type: e.target.value || undefined })}
                className="w-full px-3 py-2 border rounded-md mt-1"
              >
                <option value="">Все</option>
                <option value="income">Доходный</option>
                <option value="expense">Расходный</option>
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
                <option value="planned">Планируется</option>
                <option value="active">В работе</option>
                <option value="completed">Завершён</option>
                <option value="suspended">Приостановлен</option>
                <option value="terminated">Расторгнут</option>
              </select>
            </div>
            <div>
              <Label>Валюта</Label>
              <select
                value={filters.currency || ''}
                onChange={(e) => setFilters({ ...filters, currency: e.target.value || undefined })}
                className="w-full px-3 py-2 border rounded-md mt-1"
              >
                <option value="">Все</option>
                <option value="RUB">RUB</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div>
              <Label>Объект</Label>
              <select
                value={filters.object || ''}
                onChange={(e) => setFilters({ ...filters, object: e.target.value || undefined })}
                className="w-full px-3 py-2 border rounded-md mt-1"
              >
                <option value="">Все объекты</option>
                {objects.map((obj) => (
                  <option key={obj.id} value={obj.id}>{obj.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Контрагент</Label>
              <select
                value={filters.counterparty || ''}
                onChange={(e) => setFilters({ ...filters, counterparty: e.target.value || undefined })}
                className="w-full px-3 py-2 border rounded-md mt-1"
              >
                <option value="">Все контрагенты</option>
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

      {/* Таблица договоров */}
      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        {contracts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Договоры не найдены
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-muted-foreground">Номер</th>
                  <th className="px-6 py-3 text-left text-muted-foreground">Название</th>
                  <th className="px-6 py-3 text-left text-muted-foreground">Объект</th>
                  <th className="px-6 py-3 text-left text-muted-foreground">Тип</th>
                  <th className="px-6 py-3 text-left text-muted-foreground">Контрагент</th>
                  <th className="px-6 py-3 text-left text-muted-foreground">Компания</th>
                  <th className="px-6 py-3 text-left text-muted-foreground">Сумма</th>
                  <th className="px-6 py-3 text-left text-muted-foreground">Статус</th>
                  <th className="px-6 py-3 text-left text-muted-foreground">Дата</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contracts.map((contract) => (
                  <tr
                    key={contract.id}
                    onClick={() => navigate(`/contracts/${contract.id}`)}
                    className="hover:bg-muted cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 text-foreground">{contract.number}</td>
                    <td className="px-6 py-4 text-foreground">{contract.name}</td>
                    <td className="px-6 py-4 text-muted-foreground">{contract.object_name}</td>
                    <td className="px-6 py-4">{getTypeBadge(contract.contract_type)}</td>
                    <td className="px-6 py-4 text-muted-foreground">{contract.counterparty_name}</td>
                    <td className="px-6 py-4 text-muted-foreground">{contract.legal_entity_name}</td>
                    <td className="px-6 py-4 text-foreground">
                      {formatCurrency(contract.total_amount, contract.currency)}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(contract.status)}</td>
                    <td className="px-6 py-4 text-muted-foreground">{formatDate(contract.contract_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Счетчик */}
      <div className="text-muted-foreground">
        Всего договоров: {contractsData?.count || 0}
      </div>

      {/* Диалог создания договора */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создание нового договора</DialogTitle>
            <DialogDescription>Заполните форму для создания нового договора.</DialogDescription>
          </DialogHeader>
          <CreateContractDialog onSuccess={() => setIsCreateDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}