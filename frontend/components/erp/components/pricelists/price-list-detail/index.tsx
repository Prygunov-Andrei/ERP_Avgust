import { useState } from 'react';
import { useParams, useNavigate } from '@/hooks/erp-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, PriceListItem, UpdatePriceListItemData, CreatePriceListAgreementData, CreatePriceListData } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { CONSTANTS } from '@/constants';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ArrowLeft, Loader2, MoreVertical, Calendar, FileText, Users, Settings, Copy, Download } from 'lucide-react';
import { toast } from 'sonner';

import { PriceListItemsTab } from './PriceListItemsTab';
import { PriceListAgreementsTab } from './PriceListAgreementsTab';
import { PriceListInfoTab } from './PriceListInfoTab';
import { EditItemDialog, CreateAgreementDialog, EditPriceListDialog, CreateVersionDialog, DeleteAgreementDialog } from './PriceListDialogs';

type Tab = 'items' | 'agreements' | 'info';

export function PriceListDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('items');
  const [editingItem, setEditingItem] = useState<PriceListItem | null>(null);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [isEditPriceListDialogOpen, setEditPriceListDialogOpen] = useState(false);
  const [isAgreementDialogOpen, setAgreementDialogOpen] = useState(false);
  const [isCreateVersionDialogOpen, setCreateVersionDialogOpen] = useState(false);
  const [deleteAgreementTarget, setDeleteAgreementTarget] = useState<number | null>(null);

  const [itemFormData, setItemFormData] = useState<UpdatePriceListItemData>({ hours_override: null, coefficient_override: null, grade_override: null, is_included: true });
  const [priceListFormData, setPriceListFormData] = useState<Partial<CreatePriceListData>>({ number: '', name: '', date: '', status: 'draft', grade_1_rate: '', grade_2_rate: '', grade_3_rate: '', grade_4_rate: '', grade_5_rate: '' });
  const [agreementFormData, setAgreementFormData] = useState<CreatePriceListAgreementData>({ price_list: Number(id), counterparty: 0, agreed_date: new Date().toISOString().split('T')[0], notes: '' });

  const { data: priceList, isLoading, error } = useQuery({
    queryKey: ['price-list', id], queryFn: () => api.pricelists.getPriceListDetail(Number(id)), enabled: !!id, staleTime: CONSTANTS.REFERENCE_STALE_TIME_MS,
  });
  const { data: counterparties } = useQuery({
    queryKey: ['counterparties-vendors'], queryFn: () => api.core.getCounterparties().then((c) => c.filter((x) => x.type === 'vendor' || x.type === 'both')), staleTime: CONSTANTS.REFERENCE_STALE_TIME_MS,
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: number; data: UpdatePriceListItemData }) => api.pricelists.updatePriceListItem(itemId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['price-list', id] }); setEditDialogOpen(false); setEditingItem(null); toast.success('Позиция обновлена'); },
    onError: (error: Error) => { toast.error(`Ошибка: ${error.message}`); },
  });
  const createAgreementMutation = useMutation({
    mutationFn: (data: CreatePriceListAgreementData) => api.pricelists.createPriceListAgreement(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['price-list', id] }); setAgreementDialogOpen(false); resetAgreementForm(); toast.success('Согласование добавлено'); },
    onError: (error: Error) => { toast.error(`Ошибка: ${error.message}`); },
  });
  const updatePriceListMutation = useMutation({
    mutationFn: (data: Partial<CreatePriceListData>) => api.pricelists.updatePriceList(Number(id), data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['price-list', id] }); queryClient.invalidateQueries({ queryKey: ['price-lists'] }); setEditPriceListDialogOpen(false); toast.success('Прайс-лист обновлен'); },
    onError: (error: Error) => { toast.error(`Ошибка: ${error.message}`); },
  });
  const deleteAgreementMutation = useMutation({
    mutationFn: (agreementId: number) => api.pricelists.deletePriceListAgreement(agreementId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['price-list', id] }); setDeleteAgreementTarget(null); toast.success('Согласование удалено'); },
    onError: (error: Error) => { toast.error(`Ошибка: ${error.message}`); setDeleteAgreementTarget(null); },
  });
  const createVersionMutation = useMutation({
    mutationFn: () => api.pricelists.createPriceListVersion(Number(id)),
    onSuccess: (newVersion) => { queryClient.invalidateQueries({ queryKey: ['price-lists'] }); setCreateVersionDialogOpen(false); toast.success('Версия успешно создана'); navigate(`/price-lists/${newVersion.id}`); },
    onError: (error: Error) => { toast.error(`Ошибка: ${error.message}`); },
  });

  const resetAgreementForm = () => { setAgreementFormData({ price_list: Number(id), counterparty: 0, agreed_date: new Date().toISOString().split('T')[0], notes: '' }); };
  const handleEditItem = (item: PriceListItem) => { setEditingItem(item); setItemFormData({ hours_override: item.hours_override, coefficient_override: item.coefficient_override, grade_override: item.grade_override, is_included: item.is_included }); setEditDialogOpen(true); };
  const handleUpdateItem = (e: React.FormEvent) => { e.preventDefault(); if (editingItem) { updateItemMutation.mutate({ itemId: editingItem.id, data: itemFormData }); } };
  const handleCreateAgreement = (e: React.FormEvent) => { e.preventDefault(); if (!agreementFormData.counterparty) { toast.error('Выберите контрагента'); return; } createAgreementMutation.mutate(agreementFormData); };

  const getStatusBadge = (status: string, statusDisplay: string) => {
    const badges = { draft: 'bg-gray-100 text-gray-700', active: 'bg-green-100 text-green-700', archived: 'bg-gray-100 text-gray-500' };
    return (<span className={`inline-flex px-3 py-1.5 text-sm font-medium rounded-lg ${badges[status as keyof typeof badges] || badges.draft}`}>{statusDisplay}</span>);
  };
  const getTotalIncluded = () => { if (!priceList) return '0.00'; return priceList.items.filter((item) => item.is_included).reduce((sum, item) => sum + parseFloat(item.calculated_cost), 0).toFixed(2); };
  const getGradeRate = (grade: number) => { if (!priceList) return '—'; return formatCurrency(priceList[`grade_${grade}_rate` as keyof typeof priceList] as string); };

  const handleExport = async () => {
    if (!priceList) return;
    try {
      toast.info('Экспорт начат...');
      const blob = await api.pricelists.exportPriceList(Number(id));
      const date = priceList.date.replace(/-/g, '');
      const filename = `pricelist_${priceList.number.replace(/[\/\\]/g, '_')}_${date}.xlsx`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.setAttribute('download', filename); document.body.appendChild(link); link.click(); link.remove(); window.URL.revokeObjectURL(url);
      toast.success('Файл успешно скачан');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Ошибка при экспорте'); }
  };

  if (isLoading) { return (<div className="p-8"><div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-gray-400 animate-spin" /></div></div>); }
  if (error || !priceList) {
    return (<div className="p-8"><div className="text-center py-12"><FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">Прайс-лист не найден</p><Button variant="outline" onClick={() => navigate('/price-lists')} className="mt-4"><ArrowLeft className="w-4 h-4 mr-2" />Вернуться к списку</Button></div></div>);
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/price-lists')}><ArrowLeft className="w-4 h-4 mr-2" />Назад</Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-gray-900">{priceList.number}</h1>
              {getStatusBadge(priceList.status, priceList.status_display)}
              <span className="text-sm text-gray-500">v{priceList.version_number}</span>
            </div>
            {priceList.name && (<p className="text-sm text-gray-500 mt-1">{priceList.name}</p>)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger><Button variant="outline"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => { setPriceListFormData({ number: priceList.number, name: priceList.name || '', date: priceList.date, status: priceList.status, grade_1_rate: priceList.grade_1_rate, grade_2_rate: priceList.grade_2_rate, grade_3_rate: priceList.grade_3_rate, grade_4_rate: priceList.grade_4_rate, grade_5_rate: priceList.grade_5_rate }); setEditPriceListDialogOpen(true); }}><Settings className="w-4 h-4 mr-2" />Редактировать прайс-лист</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCreateVersionDialogOpen(true)}><Copy className="w-4 h-4 mr-2" />Создать версию</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExport}><Download className="w-4 h-4 mr-2" />Экспорт в Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          {([
            { key: 'items' as Tab, label: 'Позиции', icon: FileText, count: priceList.items.length },
            { key: 'agreements' as Tab, label: 'Согласования', icon: Users, count: priceList.agreements.length },
            { key: 'info' as Tab, label: 'Информация', icon: Calendar, count: undefined as number | undefined },
          ]).map(({ key, label, icon: Icon, count }) => (
            <button key={key} onClick={() => setActiveTab(key)} className={`pb-3 px-1 border-b-2 transition-colors ${activeTab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" /><span>{label}</span>
                {count !== undefined && (<span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">{count}</span>)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'items' && (<PriceListItemsTab items={priceList.items} onEditItem={handleEditItem} getTotalIncluded={getTotalIncluded} />)}
      {activeTab === 'agreements' && (<PriceListAgreementsTab agreements={priceList.agreements} onAddAgreement={() => setAgreementDialogOpen(true)} onDeleteAgreement={(id) => setDeleteAgreementTarget(id)} deleteAgreementMutation={deleteAgreementMutation} />)}
      {activeTab === 'info' && (<PriceListInfoTab priceList={priceList} getStatusBadge={getStatusBadge} getGradeRate={getGradeRate} />)}

      {/* Dialogs */}
      <EditItemDialog open={isEditDialogOpen} onOpenChange={setEditDialogOpen} editingItem={editingItem} formData={itemFormData} onFormChange={setItemFormData} onSubmit={handleUpdateItem} isPending={updateItemMutation.isPending} />
      <CreateAgreementDialog open={isAgreementDialogOpen} onOpenChange={setAgreementDialogOpen} formData={agreementFormData} onFormChange={setAgreementFormData} onSubmit={handleCreateAgreement} onReset={resetAgreementForm} counterparties={counterparties} isPending={createAgreementMutation.isPending} />
      <EditPriceListDialog open={isEditPriceListDialogOpen} onOpenChange={setEditPriceListDialogOpen} formData={priceListFormData} onFormChange={setPriceListFormData} onSubmit={() => updatePriceListMutation.mutate(priceListFormData)} isPending={updatePriceListMutation.isPending} />
      <CreateVersionDialog open={isCreateVersionDialogOpen} onOpenChange={setCreateVersionDialogOpen} priceList={priceList} onConfirm={() => createVersionMutation.mutate()} isPending={createVersionMutation.isPending} />
      <DeleteAgreementDialog open={deleteAgreementTarget !== null} onOpenChange={(open) => { if (!open) setDeleteAgreementTarget(null); }} onConfirm={() => { if (deleteAgreementTarget !== null) { deleteAgreementMutation.mutate(deleteAgreementTarget); setDeleteAgreementTarget(null); } }} />
    </div>
  );
}
