import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Correspondence } from '@/lib/api';
import { Loader2, Plus, ArrowDownCircle, ArrowUpCircle, Edit, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { formatDate } from '@/lib/utils';
import { CONSTANTS } from '@/constants';
import { CommunicationsFilters } from './CommunicationsFilters';
import { CommunicationsFormDialog, type CorrespondenceFormData } from './CommunicationsFormDialog';
import { CommunicationsDetailDialog, getTypeLabel, getTypeBadge, getCategoryBadge, getStatusBadge } from './CommunicationsDetailDialog';

const INITIAL_FORM: CorrespondenceFormData = {
  contract: '',
  type: 'incoming',
  category: 'уведомление',
  number: '',
  date: '',
  status: 'новое',
  subject: '',
  description: '',
  file: null,
  related_to: '',
};

export function Communications() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCorrespondence, setSelectedCorrespondence] = useState<Correspondence | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({ contract: '', type: '', category: '', status: '' });
  const [formData, setFormData] = useState<CorrespondenceFormData>({ ...INITIAL_FORM });

  const queryClient = useQueryClient();

  const { data: correspondence, isLoading: correspondenceLoading } = useQuery({
    queryKey: ['correspondence', filters, searchQuery],
    queryFn: () => api.contracts.getCorrespondence({
      contract: filters.contract && filters.contract !== 'all' ? parseInt(filters.contract) : undefined,
      type: filters.type && filters.type !== 'all' ? filters.type as 'incoming' | 'outgoing' : undefined,
      category: filters.category && filters.category !== 'all' ? filters.category : undefined,
      status: filters.status && filters.status !== 'all' ? filters.status : undefined,
      search: searchQuery || undefined,
    }),
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
  });

  const { data: contractsData } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => api.contracts.getContracts(),
    staleTime: CONSTANTS.REFERENCE_STALE_TIME_MS,
  });

  const contracts = contractsData?.results || [];

  const { data: relatedCorrespondence } = useQuery({
    queryKey: ['correspondence-for-related', formData.contract],
    queryFn: () => formData.contract ? api.contracts.getCorrespondence({ contract: parseInt(formData.contract) }) : Promise.resolve([]),
    enabled: !!formData.contract,
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
  });

  const buildMutationPayload = (data: CorrespondenceFormData) => ({
    contract: parseInt(data.contract),
    type: data.type,
    category: data.category,
    number: data.number,
    date: data.date,
    status: data.status,
    subject: data.subject,
    description: data.description || undefined,
    file: data.file || undefined,
    related_to: data.related_to ? parseInt(data.related_to) : undefined,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CorrespondenceFormData) => api.contracts.createCorrespondence(buildMutationPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['correspondence'] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast.success('Письмо успешно создано');
    },
    onError: (error: Error) => { toast.error(`Ошибка создания письма: ${error.message}`); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: CorrespondenceFormData }) =>
      api.contracts.updateCorrespondence(id, buildMutationPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['correspondence'] });
      setIsEditDialogOpen(false);
      resetForm();
      toast.success('Письмо успешно обновлено');
    },
    onError: (error: Error) => { toast.error(`Ошибка обновления письма: ${error.message}`); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.contracts.deleteCorrespondence(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['correspondence'] });
      setSelectedCorrespondence(null);
      toast.success('Письмо успешно удалено');
    },
    onError: (error: Error) => { toast.error(`Ошибка удаления письма: ${error.message}`); },
  });

  const resetForm = () => {
    setFormData({ ...INITIAL_FORM });
    setSelectedCorrespondence(null);
  };

  const handleEdit = (corr: Correspondence) => {
    setFormData({
      contract: corr.contract?.toString() || '',
      type: corr.type,
      category: corr.category,
      number: corr.number,
      date: corr.date,
      status: corr.status,
      subject: corr.subject,
      description: corr.description || '',
      file: null,
      related_to: corr.related_to?.toString() || '',
    });
    setSelectedCorrespondence(corr);
    setIsEditDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.contract || !formData.number || !formData.date || !formData.subject) {
      toast.error('Заполните все обязательные поля');
      return;
    }
    createMutation.mutate(formData);
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCorrespondence) return;
    if (!formData.contract || !formData.number || !formData.date || !formData.subject) {
      toast.error('Заполните все обязательные поля');
      return;
    }
    updateMutation.mutate({ id: selectedCorrespondence.id, data: formData });
  };

  if (correspondenceLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl mb-1">Переписка</h1>
          <p className="text-gray-500 text-sm">Управление корреспонденцией · Всего: {correspondence?.length || 0}</p>
        </div>
        <Button
          onClick={() => { resetForm(); setIsCreateDialogOpen(true); }}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Создать письмо
        </Button>
      </div>

      <CommunicationsFilters
        filters={filters}
        onFiltersChange={setFilters}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        contracts={contracts}
      />

      {/* List table */}
      <Card className="p-6">
        {!correspondence || correspondence.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Писем не найдено. Создайте первое письмо.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Дата</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Номер</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Тип</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Категория</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Договор</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Тема</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Статус</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Действия</th>
                </tr>
              </thead>
              <tbody>
                {correspondence.map((corr) => (
                  <tr
                    key={corr.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedCorrespondence(corr)}
                  >
                    <td className="py-3 px-4 text-sm text-gray-600">{formatDate(corr.date)}</td>
                    <td className="py-3 px-4 text-sm font-medium">{corr.number}</td>
                    <td className="py-3 px-4 text-sm">
                      <Badge className={getTypeBadge(corr.type)}>
                        {corr.type === 'incoming' ? (
                          <ArrowDownCircle className="w-3 h-3 mr-1 inline" />
                        ) : (
                          <ArrowUpCircle className="w-3 h-3 mr-1 inline" />
                        )}
                        {getTypeLabel(corr.type)}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <Badge className={getCategoryBadge(corr.category)}>{corr.category}</Badge>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <div>
                        <div className="font-medium">{corr.contract_name}</div>
                        <div className="text-xs text-gray-500">{corr.contract_number}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{corr.subject}</td>
                    <td className="py-3 px-4 text-sm">
                      <Badge className={getStatusBadge(corr.status)}>{corr.status}</Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(corr); }}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDeleteTargetId(corr.id); }}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create dialog */}
      <CommunicationsFormDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        title="Новое письмо"
        description="Создание нового письма в переписке"
        formData={formData}
        onFormDataChange={setFormData}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending}
        submitLabel="Создать"
        pendingLabel="Создание..."
        contracts={contracts}
        relatedCorrespondence={relatedCorrespondence}
        selectedCorrespondence={selectedCorrespondence}
      />

      {/* Edit dialog */}
      <CommunicationsFormDialog
        open={isEditDialogOpen}
        onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) resetForm(); }}
        title="Редактировать письмо"
        description="Изменение данных письма"
        formData={formData}
        onFormDataChange={setFormData}
        onSubmit={handleUpdate}
        isPending={updateMutation.isPending}
        submitLabel="Сохранить"
        pendingLabel="Сохранение..."
        contracts={contracts}
        relatedCorrespondence={relatedCorrespondence}
        selectedCorrespondence={selectedCorrespondence}
        existingFileUrl={selectedCorrespondence?.file}
      />

      {/* Delete confirmation */}
      <AlertDialog open={deleteTargetId !== null} onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить письмо</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить это письмо? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteTargetId !== null) deleteMutation.mutate(deleteTargetId); }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail dialog */}
      {selectedCorrespondence && !isEditDialogOpen && (
        <CommunicationsDetailDialog
          correspondence={selectedCorrespondence}
          onClose={() => setSelectedCorrespondence(null)}
          onEdit={handleEdit}
          onDelete={(id) => setDeleteTargetId(id)}
        />
      )}
    </div>
  );
}
