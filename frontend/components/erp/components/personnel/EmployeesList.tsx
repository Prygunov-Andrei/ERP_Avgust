import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Employee, EmployeeDetail, LegalEntity } from '@/lib/api';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Plus, Search, Loader2, Pencil, Trash2, UserCircle, CalendarDays, Building2, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { useLegalEntities } from '@/hooks';
import { EmployeeFormDialog } from './EmployeeFormDialog';

export function EmployeesList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterLegalEntity, setFilterLegalEntity] = useState<string>('all');
  const [filterActive, setFilterActive] = useState<string>('true');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeDetail | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);

  const { data: legalEntities = [] } = useLegalEntities();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees', search, filterLegalEntity, filterActive],
    queryFn: () => api.personnel.getEmployees({
      search: search || undefined,
      legal_entity: filterLegalEntity !== 'all' ? Number(filterLegalEntity) : undefined,
      is_active: filterActive !== 'all' ? filterActive === 'true' : undefined,
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.personnel.deleteEmployee(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employees'] }); toast.success('Сотрудник удалён'); setDeletingEmployee(null); },
    onError: (e: Error) => toast.error(`Ошибка: ${e?.message}`),
  });

  const handleOpenEdit = async (emp: Employee) => {
    try {
      const detail = await api.personnel.getEmployee(emp.id);
      setEditingEmployee(detail);
    } catch (e: unknown) {
      toast.error(`Ошибка загрузки: ${(e instanceof Error ? e.message : String(e))}`);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Поиск по ФИО..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterLegalEntity} onValueChange={setFilterLegalEntity}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Юр. лицо" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все юр. лица</SelectItem>
            {legalEntities.map((le: LegalEntity) => (<SelectItem key={le.id} value={String(le.id)}>{le.short_name || le.name}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={filterActive} onValueChange={setFilterActive}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все</SelectItem>
            <SelectItem value="true">Активные</SelectItem>
            <SelectItem value="false">Уволенные</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setIsCreateOpen(true)} className="ml-auto bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-1" />Добавить сотрудника</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : employees.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Нет сотрудников</p>
          <p className="text-sm">Добавьте первого сотрудника</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {employees.map((emp) => (
            <div key={emp.id} className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0"><UserCircle className="w-6 h-6 text-primary" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground truncate">{emp.full_name}</h3>
                      {!emp.is_active && (<span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full">Уволен</span>)}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{emp.current_position || 'Должность не указана'}</p>
                  </div>
                  <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
                    {emp.current_legal_entities?.length > 0 && (
                      <div className="flex items-center gap-1"><Building2 className="w-4 h-4" /><span>{emp.current_legal_entities.map((le) => le.short_name).join(', ')}</span></div>
                    )}
                    {emp.hire_date && (<div className="flex items-center gap-1"><CalendarDays className="w-4 h-4" /><span>{new Date(emp.hire_date).toLocaleDateString('ru-RU')}</span></div>)}
                    <div className="flex items-center gap-1"><Banknote className="w-4 h-4" /><span>{Number(emp.salary_full).toLocaleString('ru-RU')} P</span></div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(emp)} aria-label="Редактировать" tabIndex={0}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeletingEmployee(emp)} aria-label="Удалить" tabIndex={0}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <EmployeeFormDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} employee={null} legalEntities={legalEntities} />
      {editingEmployee && (
        <EmployeeFormDialog open={!!editingEmployee} onOpenChange={(open) => { if (!open) setEditingEmployee(null); }} employee={editingEmployee} legalEntities={legalEntities} />
      )}

      <AlertDialog open={!!deletingEmployee} onOpenChange={(open) => !open && setDeletingEmployee(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить сотрудника?</AlertDialogTitle>
            <AlertDialogDescription>Вы уверены, что хотите удалить сотрудника «{deletingEmployee?.full_name}»? Это действие нельзя отменить.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deletingEmployee && deleteMutation.mutate(deletingEmployee.id)}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
