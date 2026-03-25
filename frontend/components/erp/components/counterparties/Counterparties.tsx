import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@/hooks/erp-router';
import { api, Counterparty, CreateCounterpartyData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Loader2, Users, Trash2, ChevronLeft, ChevronRight, Merge } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { CounterpartyDedup } from '../CounterpartyDedup';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { CreateCounterpartyForm } from './CreateCounterpartyForm';
import { EditCounterpartyForm } from './EditCounterpartyForm';

type CounterpartyFilter = 'all' | 'customer' | 'potential_customer' | 'supplier' | 'executor';

type CounterpartiesProps = {
  lockedFilter?: CounterpartyFilter;
  lockedCreateType?: Counterparty['type'];
  pageTitle?: string;
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'customer': return 'Заказчик';
    case 'potential_customer': return 'Потенциальный Заказчик';
    case 'vendor': return 'Исполнитель-Поставщик';
    case 'both': return 'Заказчик и Исполнитель-Поставщик';
    case 'employee': return 'Сотрудник';
    default: return type;
  }
};

const getVendorSubtypeLabel = (subtype?: string | null) => {
  if (!subtype) return '—';
  switch (subtype) {
    case 'supplier': return 'Поставщик';
    case 'executor': return 'Исполнитель';
    case 'both': return 'Исполнитель и Поставщик';
    default: return '—';
  }
};

const getLegalFormLabel = (form?: string) => {
  if (!form) return '—';
  switch (form) {
    case 'ooo': return 'ООО';
    case 'ip': return 'ИП';
    case 'fiz': return 'Физ.лицо';
    case 'self_employed': return 'Самозанятый';
    default: return form;
  }
};

export function Counterparties({ lockedFilter, lockedCreateType, pageTitle }: CounterpartiesProps = {}) {
  const effectiveFilter = lockedFilter || 'all';
  const [filter, setFilter] = useState<CounterpartyFilter>(effectiveFilter);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCounterparty, setEditingCounterparty] = useState<Counterparty | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Counterparty | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [dedupMode, setDedupMode] = useState(false);
  const PAGE_SIZE = 20;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => { if (lockedFilter) setFilter(lockedFilter); }, [lockedFilter]);

  const apiTypeParam = useMemo(() => {
    if (filter === 'customer') return 'customer';
    if (filter === 'potential_customer') return 'potential_customer';
    if (filter === 'supplier' || filter === 'executor') return 'vendor';
    return undefined;
  }, [filter]);

  const { data: paginatedData, isLoading, error } = useQuery({
    queryKey: ['counterparties-paginated', page, apiTypeParam],
    queryFn: () => api.core.getCounterpartiesPaginated({ page, type: apiTypeParam }),
    staleTime: 60_000,
  });

  const counterparties = paginatedData?.results || [];
  const totalCount = paginatedData?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [filter]);

  const filteredCounterparties = useMemo(() => {
    if (filter === 'supplier') return counterparties.filter(cp => cp.vendor_subtype === 'supplier' || cp.vendor_subtype === 'both');
    if (filter === 'executor') return counterparties.filter(cp => cp.vendor_subtype === 'executor' || cp.vendor_subtype === 'both');
    return counterparties;
  }, [counterparties, filter]);

  const createMutation = useMutation({
    mutationFn: (data: CreateCounterpartyData) => api.core.createCounterparty(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['counterparties'] }); queryClient.invalidateQueries({ queryKey: ['counterparties-paginated'] }); setIsDialogOpen(false); toast.success('Контрагент успешно создан'); },
    onError: (error: Error) => { toast.error(`Ошибка: ${error.message}`); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateCounterpartyData> }) => api.core.updateCounterparty(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['counterparties'] }); queryClient.invalidateQueries({ queryKey: ['counterparties-paginated'] }); setIsEditDialogOpen(false); setEditingCounterparty(null); toast.success('Контрагент успешно обновлен'); },
    onError: (error: Error) => { toast.error(`Ошибка обновления контрагента: ${error?.message || 'Неизвестная ошибка'}`); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.core.deleteCounterparty(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['counterparties'] }); queryClient.invalidateQueries({ queryKey: ['counterparties-paginated'] }); toast.success('Контрагент успешно удален'); },
    onError: (error: Error) => { toast.error(`Ошибка удаления контрагента: ${error?.message || 'Неизвестная ошибка'}`); },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => api.core.deleteCounterparties(ids),
    onSuccess: (_, ids) => { queryClient.invalidateQueries({ queryKey: ['counterparties'] }); queryClient.invalidateQueries({ queryKey: ['counterparties-paginated'] }); toast.success(`Удалено контрагентов: ${ids.length}`); setSelectedIds(new Set()); setBulkDeleteConfirm(false); },
    onError: (error: Error) => { toast.error(`Ошибка удаления: ${error?.message || 'Неизвестная ошибка'}`); },
  });

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCounterparties.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredCounterparties.map(cp => cp.id)));
  };

  if (dedupMode) return <CounterpartyDedup onBack={() => setDedupMode(false)} />;

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-semibold">{pageTitle || 'Контрагенты'}</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setDedupMode(true)}>
              <Merge className="w-4 h-4 mr-2" />Дедупликация
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" />Добавить контрагента</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Новый контрагент</DialogTitle>
                  <DialogDescription>Введите ИНН или название — данные заполнятся автоматически</DialogDescription>
                </DialogHeader>
                <CreateCounterpartyForm onSubmit={(data) => createMutation.mutate(data)} isLoading={createMutation.isPending} lockedType={lockedCreateType} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {!lockedFilter && (
          <Tabs value={filter} onValueChange={(v) => setFilter(v as CounterpartyFilter)} className="mb-6">
            <TabsList>
              <TabsTrigger value="all">Все</TabsTrigger>
              <TabsTrigger value="customer">Заказчики</TabsTrigger>
              <TabsTrigger value="potential_customer">Потенциальные</TabsTrigger>
              <TabsTrigger value="supplier">Поставщики</TabsTrigger>
              <TabsTrigger value="executor">Исполнители</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
            <span className="text-sm text-primary">Выбрано: {selectedIds.size}</span>
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteConfirm(true)} disabled={bulkDeleteMutation.isPending}>
              {bulkDeleteMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Удалить выбранных
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Снять выделение</Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl">Ошибка загрузки: {(error as Error).message}</div>
        ) : !filteredCounterparties || filteredCounterparties.length === 0 ? (
          <div className="bg-muted border-2 border-dashed border-border rounded-xl p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">{filter === 'all' ? 'Нет контрагентов' : 'Нет контрагентов в этой категории'}</p>
            <Button onClick={() => setIsDialogOpen(true)} variant="outline"><Plus className="w-4 h-4 mr-2" />Добавить первого контрагента</Button>
          </div>
        ) : (
          <>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    <th className="px-3 py-2.5 w-10"><Checkbox checked={filteredCounterparties.length > 0 && selectedIds.size === filteredCounterparties.length} onCheckedChange={toggleSelectAll} /></th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Название</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-32">ИНН</th>
                    {filter === 'all' && <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-40">Тип</th>}
                    {(filter === 'all' || filter === 'supplier' || filter === 'executor') && <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-36">Подтип</th>}
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">Правовая форма</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Контакты</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCounterparties.map((counterparty: Counterparty) => (
                    <tr key={counterparty.id} className={`hover:bg-muted transition-colors cursor-pointer ${selectedIds.has(counterparty.id) ? 'bg-primary/10' : ''}`} onClick={() => navigate(`/counterparties/${counterparty.id}`)} tabIndex={0} role="link" aria-label={`Открыть карточку ${counterparty.name}`} onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/counterparties/${counterparty.id}`); }}>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}><Checkbox checked={selectedIds.has(counterparty.id)} onCheckedChange={() => toggleSelect(counterparty.id)} /></td>
                      <td className="px-4 py-2.5"><div className="text-sm text-foreground">{counterparty.name}</div>{counterparty.short_name && <div className="text-xs text-muted-foreground">{counterparty.short_name}</div>}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap"><div className="text-xs font-mono text-muted-foreground">{counterparty.inn}</div></td>
                      {filter === 'all' && (
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${counterparty.type === 'customer' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : counterparty.type === 'potential_customer' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' : counterparty.type === 'vendor' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 'bg-blue-100 dark:bg-blue-900/30 text-primary'}`}>{getTypeLabel(counterparty.type)}</span>
                        </td>
                      )}
                      {(filter === 'all' || filter === 'supplier' || filter === 'executor') && (
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {(counterparty.type === 'vendor' || counterparty.type === 'both') ? (
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${counterparty.vendor_subtype === 'supplier' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' : counterparty.vendor_subtype === 'executor' ? 'bg-indigo-100 text-indigo-700' : counterparty.vendor_subtype === 'both' ? 'bg-cyan-100 text-cyan-700' : 'bg-muted text-muted-foreground'}`}>{getVendorSubtypeLabel(counterparty.vendor_subtype)}</span>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                      )}
                      <td className="px-4 py-2.5 whitespace-nowrap"><div className="text-xs text-muted-foreground">{getLegalFormLabel(counterparty.legal_form)}</div></td>
                      <td className="px-4 py-2.5"><div className="text-xs text-muted-foreground max-w-xs truncate">{counterparty.contact_info || '—'}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">Всего: {totalCount}</div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => { setPage(p => Math.max(1, p - 1)); setSelectedIds(new Set()); }} disabled={page <= 1}><ChevronLeft className="w-4 h-4" /></Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                    .reduce<(number | 'dots')[]>((acc, p, i, arr) => { if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('dots'); acc.push(p); return acc; }, [])
                    .map((item, i) => item === 'dots' ? <span key={`dots-${i}`} className="px-1 text-muted-foreground">...</span> : <Button key={item} variant={page === item ? 'default' : 'outline'} size="sm" className="min-w-[32px]" onClick={() => { setPage(item); setSelectedIds(new Set()); }}>{item}</Button>)}
                </div>
                <Button variant="outline" size="sm" onClick={() => { setPage(p => Math.min(totalPages, p + 1)); setSelectedIds(new Set()); }} disabled={page >= totalPages}><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
          </>
        )}

        <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Удалить контрагента</AlertDialogTitle><AlertDialogDescription>Вы уверены, что хотите удалить контрагента &quot;{deleteTarget?.name}&quot;? Это действие нельзя отменить.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }} className="bg-red-600 text-white hover:bg-red-700">Удалить</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Удалить выбранных контрагентов</AlertDialogTitle><AlertDialogDescription>Вы уверены, что хотите удалить {selectedIds.size} контрагент(ов)? Это действие нельзя отменить.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))} className="bg-red-600 text-white hover:bg-red-700">Удалить</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
        </AlertDialog>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Редактировать контрагента</DialogTitle><DialogDescription>Измените информацию о контрагенте</DialogDescription></DialogHeader>
            {editingCounterparty && <EditCounterpartyForm counterparty={editingCounterparty} onSubmit={(data) => updateMutation.mutate({ id: editingCounterparty.id, data })} isLoading={updateMutation.isPending} />}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
