import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, LegalEntity, CreateLegalEntityData, TaxSystem } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Building2, Loader2, Plus, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLegalEntities, useTaxSystems } from '@/hooks';
import { LegalEntityForm } from './LegalEntityForm';

export function LegalEntitiesTab() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<LegalEntity | null>(null);
  const [deletingEntity, setDeletingEntity] = useState<LegalEntity | null>(null);
  const queryClient = useQueryClient();

  const { data: entities, isLoading, error } = useLegalEntities();
  const { data: taxSystems } = useTaxSystems();

  const getTaxSystemName = (taxSystem: string | number | TaxSystem): string => {
    if (typeof taxSystem === 'string') return taxSystem;
    if (typeof taxSystem === 'number') {
      const system = taxSystems?.find(s => s.id === taxSystem);
      return system?.name || 'Не указана';
    }
    if (typeof taxSystem === 'object' && taxSystem.name) return taxSystem.name;
    return 'Не указана';
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateLegalEntityData) => api.core.createLegalEntity(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal-entities'] });
      setIsDialogOpen(false);
      toast.success('Компания успешно создана');
    },
    onError: (error: Error) => {
      if (error.message && error.message.includes('ИНН already exists')) {
        toast.error('Компания с таким ИНН уже существует');
      } else {
        toast.error(`Ошибка: ${error.message || 'Неизвестная ошибка'}`);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateLegalEntityData> }) =>
      api.core.updateLegalEntity(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal-entities'] });
      setEditingEntity(null);
      toast.success('Компания успешно обновлена');
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.core.deleteLegalEntity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal-entities'] });
      setDeletingEntity(null);
      toast.success('Компания успешно удалена');
    },
    onError: (error: Error) => {
      if (error.message.includes('Cannot delete') || error.message.includes('связанные')) {
        toast.error('Нельзя удалить компанию, по которой есть операции');
      } else {
        toast.error(`Ошибка: ${error.message}`);
      }
      setDeletingEntity(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-xl">
        Ошибка загрузки: {(error as Error).message}
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-600">
          {entities?.length || 0} {entities?.length === 1 ? 'компания' : 'компаний'}
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Добавить компанию
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Новая компания</DialogTitle>
            <DialogDescription>Введите информацию о юридическом лице</DialogDescription>
          </DialogHeader>
          <LegalEntityForm
            onSubmit={(data) => createMutation.mutate(data)}
            isLoading={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingEntity} onOpenChange={(open) => !open && setEditingEntity(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редактировать компанию</DialogTitle>
            <DialogDescription>Измените информацию о юридическом лице</DialogDescription>
          </DialogHeader>
          {editingEntity && (
            <LegalEntityForm
              entity={editingEntity}
              onSubmit={(data) => updateMutation.mutate({ id: editingEntity.id, data })}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingEntity} onOpenChange={(open) => !open && setDeletingEntity(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Компания "{deletingEntity?.name}" будет удалена навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingEntity && deleteMutation.mutate(deletingEntity.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!entities || entities.length === 0 ? (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">Нет юридических лиц</p>
          <Button onClick={() => setIsDialogOpen(true)} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Добавить первую компанию
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {entities.map((entity: LegalEntity) => (
            <div
              key={entity.id}
              className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{entity.name}</h3>
                  {entity.short_name && (
                    <p className="text-sm text-gray-500">{entity.short_name}</p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditingEntity(entity)}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Редактировать
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeletingEntity(entity)}
                      className="text-red-600"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Удалить
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">ИНН:</span>{' '}
                  <span className="text-gray-900 font-mono">{entity.inn}</span>
                </div>
                {entity.kpp && (
                  <div>
                    <span className="text-gray-500">КПП:</span>{' '}
                    <span className="text-gray-900 font-mono">{entity.kpp}</span>
                  </div>
                )}
                {entity.ogrn && (
                  <div>
                    <span className="text-gray-500">ОГРН:</span>{' '}
                    <span className="text-gray-900 font-mono">{entity.ogrn}</span>
                  </div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-500">Система налогообложения</div>
                <div className="text-sm font-medium text-gray-700 mt-1">
                  {getTaxSystemName(entity.tax_system)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
