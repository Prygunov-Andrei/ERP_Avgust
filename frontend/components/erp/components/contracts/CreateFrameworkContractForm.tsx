import { useState, useEffect } from 'react';
import { useNavigate, useParams } from '@/hooks/erp-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { FrameworkContractDetail, LegalEntity, Counterparty } from '@/lib/api';
import type { PriceListList } from '@/lib/api/types/pricelists';
import type { CreateFrameworkContractData } from '@/lib/api/types/contracts';
import { unwrapResults } from '@/lib/api/types/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { formatDate, formatAmount, formatCurrency } from '@/lib/utils';
import { CONSTANTS } from '@/constants';
import { useLegalEntities, usePriceLists } from '@/hooks';

interface FrameworkContractFormData {
  name: string;
  date: string;
  valid_from: string;
  valid_until: string;
  legal_entity: number | '';
  counterparty: number | '';
  status: 'draft' | 'active' | 'expired' | 'terminated';
  price_lists: number[];
  file?: File | null;
  notes: string;
}

export function CreateFrameworkContractForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const [formData, setFormData] = useState<FrameworkContractFormData>({
    name: '',
    date: new Date().toISOString().split('T')[0],
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: '',
    legal_entity: '',
    counterparty: '',
    status: 'draft',
    price_lists: [],
    file: null,
    notes: '',
  });

  // Загрузка существующего рамочного договора для редактирования
  const { data: existingContract, isLoading: isLoadingContract } = useQuery({
    queryKey: ['framework-contract', id],
    queryFn: () => api.contracts.getFrameworkContract(parseInt(id!)),
    enabled: isEditing,
    staleTime: CONSTANTS.REFERENCE_STALE_TIME_MS,
  });

  // Загрузка справочников с кешированием
  const { data: legalEntitiesData } = useLegalEntities();

  const { data: counterpartiesData } = useQuery({
    queryKey: ['counterparties', { type: 'vendor,both' }],
    queryFn: () => api.core.getCounterparties({ type: 'vendor,both' }),
    staleTime: CONSTANTS.REFERENCE_STALE_TIME_MS,
  });

  const { data: priceListsData } = usePriceLists();

  // Заполнение формы при редактировании
  useEffect(() => {
    if (existingContract) {
      setFormData({
        name: existingContract.name,
        date: existingContract.date,
        valid_from: existingContract.valid_from,
        valid_until: existingContract.valid_until,
        legal_entity: existingContract.legal_entity,
        counterparty: existingContract.counterparty,
        status: existingContract.status,
        price_lists: existingContract.price_lists || [],
        file: null,
        notes: existingContract.notes || '',
      });
    }
  }, [existingContract]);

  // Создание рамочного договора
  const createMutation = useMutation({
    mutationFn: async (data: FrameworkContractFormData) => {
      const payload: CreateFrameworkContractData = {
        name: data.name,
        date: data.date,
        valid_from: data.valid_from,
        valid_until: data.valid_until,
        legal_entity: Number(data.legal_entity),
        counterparty: Number(data.counterparty),
        status: data.status,
        notes: data.notes || undefined,
        file: data.file || undefined,
        price_lists: data.price_lists.length > 0 ? data.price_lists : undefined,
      };

      return api.contracts.createFrameworkContract(payload);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['framework-contracts'] });
      toast.success('Рамочный договор создан');
      navigate(`/contracts/framework-contracts/${data.id}`);
    },
    onError: (error: Error) => {
      const errorMessage = (error as Error & { response?: { data?: { error?: string } } }).response?.data?.error || error.message || 'Ошибка создания';
      toast.error(errorMessage);
    },
  });

  // Обновление рамочного договора
  const updateMutation = useMutation({
    mutationFn: async (data: FrameworkContractFormData) => {
      const payload: CreateFrameworkContractData = {
        name: data.name,
        date: data.date,
        valid_from: data.valid_from,
        valid_until: data.valid_until,
        legal_entity: Number(data.legal_entity),
        counterparty: Number(data.counterparty),
        status: data.status,
        notes: data.notes || undefined,
        file: data.file || undefined,
        price_lists: data.price_lists.length > 0 ? data.price_lists : undefined,
      };

      return api.contracts.updateFrameworkContract(parseInt(id!), payload);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['framework-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['framework-contract', id] });
      toast.success('Рамочный договор обновлён');
      navigate(`/contracts/framework-contracts/${data.id}`);
    },
    onError: (error: Error) => {
      const errorMessage = (error as Error & { response?: { data?: { error?: string } } }).response?.data?.error || error.message || 'Ошибка обновления';
      toast.error(errorMessage);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Валидация
    if (!formData.name || !formData.date || !formData.valid_from || !formData.valid_until) {
      toast.error('Заполните все обязательные поля');
      return;
    }

    if (!formData.legal_entity || !formData.counterparty) {
      toast.error('Выберите компанию и контрагента');
      return;
    }

    if (new Date(formData.valid_until) < new Date(formData.valid_from)) {
      toast.error('Дата окончания должна быть >= даты начала действия');
      return;
    }

    if (isEditing) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleChange = (field: keyof FrameworkContractFormData, value: FrameworkContractFormData[keyof FrameworkContractFormData]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePriceListToggle = (priceListId: number) => {
    setFormData(prev => ({
      ...prev,
      price_lists: prev.price_lists.includes(priceListId)
        ? prev.price_lists.filter(id => id !== priceListId)
        : [...prev.price_lists, priceListId],
    }));
  };

  if (isEditing && isLoadingContract) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const legalEntities = unwrapResults<LegalEntity>(legalEntitiesData);
  const counterparties = unwrapResults<Counterparty>(counterpartiesData);
  const priceLists = unwrapResults<PriceListList>(priceListsData);
  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Хедер */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            onClick={() => navigate('/contracts/framework-contracts')}
            className="bg-muted text-foreground hover:bg-muted px-3"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-foreground">
              {isEditing ? 'Редактировать рамочный договор' : 'Создать рамочный договор'}
            </h1>
            <p className="text-muted-foreground">
              {isEditing ? 'Изменение данных рамочного договора' : 'Создание нового рамочного договора с поставщиком'}
            </p>
          </div>
        </div>
      </div>

      {/* Форма */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Основная информация */}
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <h2 className="text-foreground mb-4">Основная информация</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="name">Название *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Название рамочного договора"
                required
                maxLength={255}
              />
            </div>

            <div>
              <Label htmlFor="date">Дата заключения *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="status">Статус</Label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="draft">Черновик</option>
                <option value="active">Действующий</option>
                <option value="expired">Истёк срок</option>
                <option value="terminated">Расторгнут</option>
              </select>
            </div>

            <div>
              <Label htmlFor="valid_from">Начало действия *</Label>
              <Input
                id="valid_from"
                type="date"
                value={formData.valid_from}
                onChange={(e) => handleChange('valid_from', e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="valid_until">Окончание действия *</Label>
              <Input
                id="valid_until"
                type="date"
                value={formData.valid_until}
                onChange={(e) => handleChange('valid_until', e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Должна быть &gt;= даты начала действия
              </p>
            </div>
          </div>
        </div>

        {/* Стороны */}
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <h2 className="text-foreground mb-4">Стороны</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="legal_entity">Наша компания *</Label>
              <select
                id="legal_entity"
                value={formData.legal_entity}
                onChange={(e) => handleChange('legal_entity', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                <option value="">Выберите компанию</option>
                {legalEntities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.short_name || entity.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="counterparty">Исполнитель (Поставщик) *</Label>
              <select
                id="counterparty"
                value={formData.counterparty}
                onChange={(e) => handleChange('counterparty', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                <option value="">Выберите контрагента</option>
                {counterparties.map((cp) => (
                  <option key={cp.id} value={cp.id}>
                    {cp.short_name || cp.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Только контрагенты типа "Поставщик" или "Универсальный"
              </p>
            </div>
          </div>
        </div>

        {/* Прайс-листы */}
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <h2 className="text-foreground mb-4">Прайс-листы</h2>
          <p className="text-muted-foreground mb-4">Выберите согласованные прайс-листы</p>
          
          {priceLists.length === 0 ? (
            <div className="text-muted-foreground text-center py-4">
              Нет доступных прайс-листов
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {priceLists.map((pl) => (
                <label
                  key={pl.id}
                  className="flex items-center gap-3 p-3 border border-border rounded-md hover:bg-muted cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formData.price_lists.includes(pl.id)}
                    onChange={() => handlePriceListToggle(pl.id)}
                    className="w-4 h-4 text-primary"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-foreground">
                      {pl.number} - {pl.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      от {formatDate(pl.date)}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Файл и примечания */}
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <h2 className="text-foreground mb-4">Документы и примечания</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="file">Скан договора</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  handleChange('file', file || null);
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Форматы: PDF, JPG, PNG
              </p>
              {isEditing && existingContract?.file && !formData.file && (
                <p className="text-xs text-primary mt-1">
                  Текущий файл:{' '}
                  <a
                    href={existingContract.file}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Просмотр
                  </a>
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="notes">Примечания</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Дополнительная информация о договоре"
                rows={4}
              />
            </div>
          </div>
        </div>

        {/* Кнопки действий */}
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              onClick={() => navigate('/contracts/framework-contracts')}
              className="bg-muted text-foreground hover:bg-muted"
              disabled={isLoading}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 text-white hover:bg-blue-700"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {isEditing ? 'Сохранить изменения' : 'Создать рамочный договор'}
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
