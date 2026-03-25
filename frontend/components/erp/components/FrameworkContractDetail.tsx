import { useState } from 'react';
import { useParams, useNavigate } from '@/hooks/erp-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  FileText,
  Calendar,
  Building2,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Download,
  X,
} from 'lucide-react';
import { api, FrameworkContractDetail as FCDetail, ContractListItem, PriceListList } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { formatDate, formatAmount, formatCurrency } from '@/lib/utils';
import { CONSTANTS } from '@/constants';

type TabType = 'info' | 'price-lists' | 'contracts';

export function FrameworkContractDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isActivateDialogOpen, setIsActivateDialogOpen] = useState(false);
  const [isTerminateDialogOpen, setIsTerminateDialogOpen] = useState(false);

  // Загрузка рамочного договора
  const { data: frameworkContract, isLoading } = useQuery({
    queryKey: ['framework-contract', id],
    queryFn: () => api.contracts.getFrameworkContract(parseInt(id!)),
    enabled: !!id,
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
  });

  // Загрузка договоров под этот рамочный
  const { data: contracts } = useQuery({
    queryKey: ['framework-contract-contracts', id],
    queryFn: () => api.contracts.getFrameworkContractContracts(parseInt(id!)),
    enabled: !!id && activeTab === 'contracts',
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
  });

  // Удаление рамочного договора
  const deleteMutation = useMutation({
    mutationFn: () => api.contracts.deleteFrameworkContract(parseInt(id!)),
    onSuccess: () => {
      toast.success('Рамочный договор удалён');
      navigate('/contracts/framework-contracts');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Ошибка удаления');
    },
  });

  // Активация договора
  const activateMutation = useMutation({
    mutationFn: () => api.contracts.activateFrameworkContract(parseInt(id!)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['framework-contract', id] });
      toast.success('Рамочный договор активирован');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Ошибка активации');
    },
  });

  // Расторжение договора
  const terminateMutation = useMutation({
    mutationFn: () => api.contracts.terminateFrameworkContract(parseInt(id!)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['framework-contract', id] });
      toast.success('Рамочный договор расторгнут');
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  const handleDelete = () => {
    setIsDeleteDialogOpen(true);
  };

  const handleActivate = () => {
    setIsActivateDialogOpen(true);
  };

  const handleTerminate = () => {
    setIsTerminateDialogOpen(true);
  };

  const getStatusBadge = (status: string, isActive: boolean) => {
    if (isActive) {
      return <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">Действующий</Badge>;
    }

    const statusConfig = {
      draft: { label: 'Черновик', className: 'bg-muted text-foreground' },
      active: { label: 'Активный', className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400' },
      expired: { label: 'Истёк срок', className: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400' },
      terminated: { label: 'Расторгнут', className: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400 dark:text-orange-400' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  if (!frameworkContract) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
        <div className="text-muted-foreground">Рамочный договор не найден</div>
        <Button onClick={() => navigate('/contracts/framework-contracts')} className="mt-4">
          Вернуться к списку
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Хедер */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4">
            <Button
              onClick={() => navigate('/contracts/framework-contracts')}
              className="bg-muted text-foreground hover:bg-muted px-3"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-foreground">{frameworkContract.name}</h1>
                {getStatusBadge(frameworkContract.status, frameworkContract.is_active)}
              </div>
              <div className="flex items-center gap-4 text-muted-foreground">
                <span>№ {frameworkContract.number}</span>
                <span>от {formatDate(frameworkContract.date)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {frameworkContract.status === 'draft' && (
              <Button
                onClick={handleActivate}
                className="bg-green-600 text-white hover:bg-green-700"
                disabled={activateMutation.isPending}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Активировать
              </Button>
            )}
            {frameworkContract.status === 'active' && (
              <Button
                onClick={handleTerminate}
                className="bg-orange-600 text-white hover:bg-orange-700"
                disabled={terminateMutation.isPending}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Расторгнуть
              </Button>
            )}
            <Button
              onClick={() => navigate(`/contracts/framework-contracts/${id}/edit`)}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              <Pencil className="w-4 h-4 mr-2" />
              Редактировать
            </Button>
            <Button
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Предупреждения */}
        {frameworkContract.is_expired && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-900">Срок действия договора истёк</span>
          </div>
        )}

        {!frameworkContract.is_active && frameworkContract.status === 'active' && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 dark:border-orange-800 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <span className="text-orange-900">
              {frameworkContract.days_until_expiration < 0
                ? 'Срок действия истёк'
                : 'Договор ещё не вступил в силу'}
            </span>
          </div>
        )}

        {frameworkContract.days_until_expiration > 0 && frameworkContract.days_until_expiration <= 30 && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <span className="text-yellow-900">
              До истечения срока действия осталось {frameworkContract.days_until_expiration} дн.
            </span>
          </div>
        )}

        {/* Вкладки */}
        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-4 py-2 -mb-px transition-colors ${
              activeTab === 'info'
                ? 'border-b-2 border-blue-600 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Основная информация
          </button>
          <button
            onClick={() => setActiveTab('price-lists')}
            className={`px-4 py-2 -mb-px transition-colors ${
              activeTab === 'price-lists'
                ? 'border-b-2 border-blue-600 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Прайс-листы ({frameworkContract.price_lists?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('contracts')}
            className={`px-4 py-2 -mb-px transition-colors ${
              activeTab === 'contracts'
                ? 'border-b-2 border-blue-600 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Договоры ({frameworkContract.contracts_count})
          </button>
        </div>
      </div>

      {/* Контент вкладок */}
      {activeTab === 'info' && <InfoTab frameworkContract={frameworkContract} />}
      {activeTab === 'price-lists' && <PriceListsTab frameworkContract={frameworkContract} />}
      {activeTab === 'contracts' && <ContractsTab contracts={contracts || []} />}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить рамочный договор</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить рамочный договор &quot;{frameworkContract.name}&quot;? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isActivateDialogOpen} onOpenChange={setIsActivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Активировать договор</AlertDialogTitle>
            <AlertDialogDescription>
              Активировать рамочный договор?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => activateMutation.mutate()}>
              Активировать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isTerminateDialogOpen} onOpenChange={setIsTerminateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Расторгнуть договор</AlertDialogTitle>
            <AlertDialogDescription>
              Расторгнуть рамочный договор? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => terminateMutation.mutate()}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Расторгнуть
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Вкладка "Основная информация"
function InfoTab({ frameworkContract }: { frameworkContract: FCDetail }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Основная информация */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h2 className="text-foreground mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Основная информация
        </h2>
        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground">Исполнитель</Label>
            <div className="mt-1 flex items-start gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground mt-1" />
              <div className="text-foreground">{frameworkContract.counterparty_name}</div>
            </div>
          </div>

          <div>
            <Label className="text-muted-foreground">Наша компания</Label>
            <div className="mt-1 text-foreground">{frameworkContract.legal_entity_name}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Дата заключения</Label>
              <div className="mt-1 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">{formatDate(frameworkContract.date)}</span>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground">Создал</Label>
              <div className="mt-1 flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">{frameworkContract.created_by_name}</span>
              </div>
            </div>
          </div>

          {frameworkContract.notes && (
            <div>
              <Label className="text-muted-foreground">Примечания</Label>
              <div className="mt-1 text-foreground whitespace-pre-wrap">{frameworkContract.notes}</div>
            </div>
          )}

          {frameworkContract.file && (
            <div>
              <Label className="text-muted-foreground">Файл договора</Label>
              <a
                href={frameworkContract.file}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 flex items-center gap-2 text-primary hover:text-primary"
              >
                <Download className="w-4 h-4" />
                Скачать файл
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Срок действия и статистика */}
      <div className="space-y-6">
        {/* Срок действия */}
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <h2 className="text-foreground mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-green-600" />
            Срок действия
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Начало:</span>
              <span className="text-foreground">{formatDate(frameworkContract.valid_from)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Окончание:</span>
              <span className="text-foreground">{formatDate(frameworkContract.valid_until)}</span>
            </div>
            {frameworkContract.days_until_expiration > 0 && (
              <div className="pt-3 border-t border-border">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Дней до окончания:</span>
                  <span className={`font-medium ${
                    frameworkContract.days_until_expiration <= 30 ? 'text-orange-600' : 'text-foreground'
                  }`}>
                    {frameworkContract.days_until_expiration}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Статистика */}
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <h2 className="text-foreground mb-4">Статистика</h2>
          <div className="space-y-3">
            <div className="bg-primary/10 rounded-lg p-4">
              <div className="text-muted-foreground mb-1">Количество договоров</div>
              <div className="text-blue-900">{frameworkContract.contracts_count}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-muted-foreground mb-1">бщая сумма договоров</div>
              <div className="text-green-900">{formatCurrency(frameworkContract.total_contracts_amount)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Вкладка "Прайс-листы"
function PriceListsTab({ frameworkContract }: { frameworkContract: FCDetail }) {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedPriceLists, setSelectedPriceLists] = useState<number[]>([]);
  const [removePriceListTarget, setRemovePriceListTarget] = useState<{ id: number; name: string } | null>(null);

  // Загрузка всех прайс-листов
  const { data: allPriceLists } = useQuery({
    queryKey: ['price-lists'],
    queryFn: () => api.pricelists.getPriceLists(),
    staleTime: CONSTANTS.REFERENCE_STALE_TIME_MS,
  });

  // Добавление прайс-листов
  const addPriceListsMutation = useMutation({
    mutationFn: (priceListIds: number[]) =>
      api.contracts.addPriceListsToFrameworkContract(frameworkContract.id, priceListIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['framework-contract', frameworkContract.id.toString()] });
      toast.success('Прайс-листы добавлены');
      setIsAddDialogOpen(false);
      setSelectedPriceLists([]);
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  // Удаление прайс-листа
  const removePriceListMutation = useMutation({
    mutationFn: (priceListIds: number[]) =>
      api.contracts.removePriceListsFromFrameworkContract(frameworkContract.id, priceListIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['framework-contract', frameworkContract.id.toString()] });
      toast.success('Прайс-лист удалён');
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  const handleAddPriceLists = () => {
    if (selectedPriceLists.length === 0) {
      toast.error('Выберите хотя бы один прайс-лист');
      return;
    }
    addPriceListsMutation.mutate(selectedPriceLists);
  };

  const handleRemovePriceList = (priceListId: number, priceListName: string) => {
    setRemovePriceListTarget({ id: priceListId, name: priceListName });
  };

  // Фильтруем доступные для добавления прайс-листы
  const allPriceListsArray: PriceListList[] = Array.isArray(allPriceLists) ? allPriceLists : [];
  const availablePriceLists = allPriceListsArray.filter(
    (pl) => !frameworkContract.price_lists.includes(pl.id)
  );

  if (!frameworkContract.price_lists_details || frameworkContract.price_lists_details.length === 0) {
    return (
      <div className="bg-card rounded-lg shadow-sm border border-border p-12">
        <div className="text-center text-muted-foreground">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="mb-4">Прайс-листы не добавлены</p>
          <Button
            onClick={() => setIsAddDialogOpen(true)}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Добавить прайс-листы
          </Button>
        </div>

        {/* Диалог добавления прайс-листов */}
        {isAddDialogOpen && (
          <AddPriceListsDialog
            open={isAddDialogOpen}
            onClose={() => setIsAddDialogOpen(false)}
            availablePriceLists={availablePriceLists}
            selectedPriceLists={selectedPriceLists}
            setSelectedPriceLists={setSelectedPriceLists}
            onAdd={handleAddPriceLists}
            isPending={addPriceListsMutation.isPending}
          />
        )}

        <AlertDialog open={removePriceListTarget !== null} onOpenChange={(open) => { if (!open) setRemovePriceListTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить прайс-лист</AlertDialogTitle>
              <AlertDialogDescription>
                Удалить прайс-лист &quot;{removePriceListTarget?.name}&quot; из договора?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => { if (removePriceListTarget) removePriceListMutation.mutate([removePriceListTarget.id]); }}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                Удалить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-foreground">Согласованные прайс-листы</h2>
          <Button
            onClick={() => setIsAddDialogOpen(true)}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Добавить
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {frameworkContract.price_lists_details.map((priceList) => (
            <div
              key={priceList.id}
              className="border border-border rounded-lg p-4 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-foreground">{priceList.name}</h3>
                  <p className="text-muted-foreground mt-1">
                    Версия: {priceList.version_number || 1}
                  </p>
                </div>
                <Button
                  onClick={() => handleRemovePriceList(priceList.id, priceList.name)}
                  className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 px-2 py-1"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Диалог добавления прайс-листов */}
      {isAddDialogOpen && (
        <AddPriceListsDialog
          open={isAddDialogOpen}
          onClose={() => setIsAddDialogOpen(false)}
          availablePriceLists={availablePriceLists}
          selectedPriceLists={selectedPriceLists}
          setSelectedPriceLists={setSelectedPriceLists}
          onAdd={handleAddPriceLists}
          isPending={addPriceListsMutation.isPending}
        />
      )}

      <AlertDialog open={removePriceListTarget !== null} onOpenChange={(open) => { if (!open) setRemovePriceListTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить прайс-лист</AlertDialogTitle>
            <AlertDialogDescription>
              Удалить прайс-лист &quot;{removePriceListTarget?.name}&quot; из договора?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (removePriceListTarget) removePriceListMutation.mutate([removePriceListTarget.id]); }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Вкладка "Договоры"
function ContractsTab({ contracts }: { contracts: ContractListItem[] }) {
  const navigate = useNavigate();

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      planned: { label: 'Запланирован', className: 'bg-muted text-foreground' },
      active: { label: 'В работе', className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400' },
      completed: { label: 'Завершён', className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' },
      terminated: { label: 'Расторгнут', className: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400' },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.planned;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  if (contracts.length === 0) {
    return (
      <div className="bg-card rounded-lg shadow-sm border border-border p-12">
        <div className="text-center text-muted-foreground">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p>Договоры под этот рамочный договор не созданы</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-6">
      <h2 className="text-foreground mb-4">Договоры ({contracts.length})</h2>
      <div className="space-y-3">
        {contracts.map((contract) => (
          <div
            key={contract.id}
            onClick={() => navigate(`/contracts/${contract.id}`)}
            className="border border-border rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-foreground">{contract.name}</h3>
                  {getStatusBadge(contract.status)}
                </div>
                <div className="flex items-center gap-4 text-muted-foreground">
                  <span>№ {contract.number}</span>
                  <span>{formatDate(contract.contract_date)}</span>
                  <span>{contract.object_name}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-muted-foreground">Сумма</div>
                <div className="text-foreground">{formatCurrency(contract.total_amount)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Диалог добавления прайс-листов
function AddPriceListsDialog({
  open,
  onClose,
  availablePriceLists,
  selectedPriceLists,
  setSelectedPriceLists,
  onAdd,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  availablePriceLists: PriceListList[];
  selectedPriceLists: number[];
  setSelectedPriceLists: (ids: number[]) => void;
  onAdd: () => void;
  isPending: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-foreground">Добавить прайс-листы</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-96">
          {availablePriceLists.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Нет доступных прайс-листов для добавления
            </div>
          ) : (
            <div className="space-y-2">
              {availablePriceLists.map((priceList) => (
                <label
                  key={priceList.id}
                  className="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-muted cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedPriceLists.includes(priceList.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPriceLists([...selectedPriceLists, priceList.id]);
                      } else {
                        setSelectedPriceLists(selectedPriceLists.filter((id) => id !== priceList.id));
                      }
                    }}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="text-foreground">{priceList.name}</div>
                    <div className="text-muted-foreground">Версия: {priceList.version_number || 1}</div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="p-6 border-t border-border flex justify-end gap-2">
          <Button onClick={onClose} className="bg-muted text-foreground hover:bg-muted">
            Отмена
          </Button>
          <Button
            onClick={onAdd}
            disabled={selectedPriceLists.length === 0 || isPending}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            Добавить ({selectedPriceLists.length})
          </Button>
        </div>
      </div>
    </div>
  );
}