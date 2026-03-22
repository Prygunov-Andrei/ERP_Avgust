import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, EmployeeDetail, CreateSalaryRecordData } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

interface SalaryHistoryTabProps {
  employee: EmployeeDetail;
}

export function SalaryHistoryTab({ employee }: SalaryHistoryTabProps) {
  const queryClient = useQueryClient();
  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [newSalary, setNewSalary] = useState<CreateSalaryRecordData>({
    salary_full: Number(employee.salary_full) || 0,
    salary_official: Number(employee.salary_official) || 0,
    effective_date: new Date().toISOString().split('T')[0],
    reason: '',
  });

  const createSalaryMutation = useMutation({
    mutationFn: (data: CreateSalaryRecordData) => api.personnel.createSalaryRecord(employee.id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employees'] }); toast.success('Запись об окладе добавлена'); setShowSalaryForm(false); },
    onError: (e: Error) => toast.error(`Ошибка: ${e?.message}`),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">История оклада</h3>
        <Button size="sm" onClick={() => setShowSalaryForm(!showSalaryForm)} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-1" />Добавить</Button>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-gray-500 mb-1">Текущий оклад</p>
        <div className="flex gap-6">
          <div>
            <p className="text-2xl font-bold text-gray-900">{Number(employee.salary_full).toLocaleString('ru-RU')} P</p>
            <p className="text-xs text-gray-500">Полный</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-600">{Number(employee.salary_official).toLocaleString('ru-RU')} P</p>
            <p className="text-xs text-gray-500">Официальный</p>
          </div>
        </div>
      </div>

      {showSalaryForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Оклад полный (P) *</Label><Input type="number" value={newSalary.salary_full || ''} onChange={(e) => setNewSalary((p) => ({ ...p, salary_full: Number(e.target.value) }))} /></div>
            <div><Label>Оклад официальный (P) *</Label><Input type="number" value={newSalary.salary_official || ''} onChange={(e) => setNewSalary((p) => ({ ...p, salary_official: Number(e.target.value) }))} /></div>
            <div><Label>Дата вступления в силу *</Label><Input type="date" value={newSalary.effective_date} onChange={(e) => setNewSalary((p) => ({ ...p, effective_date: e.target.value }))} /></div>
            <div><Label>Причина</Label><Input value={newSalary.reason || ''} onChange={(e) => setNewSalary((p) => ({ ...p, reason: e.target.value }))} placeholder="Повышение, индексация..." /></div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createSalaryMutation.mutate(newSalary)} disabled={createSalaryMutation.isPending} className="bg-green-600 hover:bg-green-700">
              {createSalaryMutation.isPending ? (<Loader2 className="w-4 h-4 mr-1 animate-spin" />) : (<Save className="w-4 h-4 mr-1" />)}Сохранить
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowSalaryForm(false)}>Отмена</Button>
          </div>
        </div>
      )}

      {employee.salary_history.length > 0 && (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Дата</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Полный</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Официальный</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Причина</th>
              </tr>
            </thead>
            <tbody>
              {employee.salary_history.map((sh, idx) => (
                <tr key={sh.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-2">{new Date(sh.effective_date).toLocaleDateString('ru-RU')}</td>
                  <td className="px-4 py-2 text-right font-mono">{Number(sh.salary_full).toLocaleString('ru-RU')} P</td>
                  <td className="px-4 py-2 text-right font-mono">{Number(sh.salary_official).toLocaleString('ru-RU')} P</td>
                  <td className="px-4 py-2 text-gray-500">{sh.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
