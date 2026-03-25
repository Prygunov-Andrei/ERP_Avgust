import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, EmployeeDetail, CreatePositionRecordData, LegalEntity } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2, Save, Building2 } from 'lucide-react';
import { toast } from 'sonner';

interface PositionRecordsTabProps {
  employee: EmployeeDetail;
  legalEntities: LegalEntity[];
}

export function PositionRecordsTab({ employee, legalEntities }: PositionRecordsTabProps) {
  const queryClient = useQueryClient();
  const [showPositionForm, setShowPositionForm] = useState(false);
  const [newPosition, setNewPosition] = useState<CreatePositionRecordData>({
    legal_entity: legalEntities[0]?.id || 0,
    position_title: '',
    start_date: new Date().toISOString().split('T')[0],
    is_current: true,
  });

  const createPositionMutation = useMutation({
    mutationFn: (data: CreatePositionRecordData) => api.personnel.createPositionRecord(employee.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Должность добавлена');
      setShowPositionForm(false);
      setNewPosition({ legal_entity: legalEntities[0]?.id || 0, position_title: '', start_date: new Date().toISOString().split('T')[0], is_current: true });
      if (employee) { api.personnel.getEmployee(employee.id).then((detail) => { queryClient.setQueryData(['employee', employee.id], detail); }); }
    },
    onError: (e: Error) => toast.error(`Ошибка: ${e?.message}`),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">История должностей</h3>
        <Button size="sm" onClick={() => setShowPositionForm(!showPositionForm)} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-1" />Добавить</Button>
      </div>

      {showPositionForm && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Юридическое лицо *</Label>
              <Select value={String(newPosition.legal_entity)} onValueChange={(v) => setNewPosition((p) => ({ ...p, legal_entity: Number(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{legalEntities.map((le) => (<SelectItem key={le.id} value={String(le.id)}>{le.short_name || le.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div><Label>Должность *</Label><Input value={newPosition.position_title} onChange={(e) => setNewPosition((p) => ({ ...p, position_title: e.target.value }))} placeholder="Менеджер проекта" /></div>
            <div><Label>Дата начала *</Label><Input type="date" value={newPosition.start_date} onChange={(e) => setNewPosition((p) => ({ ...p, start_date: e.target.value }))} /></div>
            <div><Label>Дата окончания</Label><Input type="date" value={newPosition.end_date || ''} onChange={(e) => setNewPosition((p) => ({ ...p, end_date: e.target.value || null, is_current: !e.target.value }))} /></div>
            <div><Label>Номер приказа</Label><Input value={newPosition.order_number || ''} onChange={(e) => setNewPosition((p) => ({ ...p, order_number: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createPositionMutation.mutate(newPosition)} disabled={!newPosition.position_title || !newPosition.legal_entity || createPositionMutation.isPending} className="bg-green-600 hover:bg-green-700">
              {createPositionMutation.isPending ? (<Loader2 className="w-4 h-4 mr-1 animate-spin" />) : (<Save className="w-4 h-4 mr-1" />)}Сохранить
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowPositionForm(false)}>Отмена</Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {employee.positions.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">Нет записей о должностях</p>
        ) : (
          employee.positions.map((pos) => (
            <div key={pos.id} className={`border rounded-xl p-4 ${pos.is_current ? 'border-green-300 bg-green-50 dark:bg-green-900/20' : 'border-border bg-card'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{pos.position_title}</h4>
                    {pos.is_current && (<span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full">Текущая</span>)}
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1"><Building2 className="w-3.5 h-3.5" />{pos.legal_entity_name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(pos.start_date).toLocaleDateString('ru-RU')}
                    {pos.end_date ? ` — ${new Date(pos.end_date).toLocaleDateString('ru-RU')}` : ' — н.в.'}
                  </p>
                  {pos.order_number && (<p className="text-xs text-muted-foreground mt-1">Приказ: {pos.order_number}</p>)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
