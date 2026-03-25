import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, WorklogShift, PaginatedResponse } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { CONSTANTS } from '@/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock, Filter, Plus, CheckCircle2, XCircle, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { PaginationBar } from './PaginationBar';
import { SHIFT_TYPE_LABELS, SHIFT_STATUS_STYLES } from './constants';

function ShiftRow({ shift, onActivate, onClose }: {
  shift: WorklogShift;
  onActivate?: (id: string) => void;
  onClose?: (id: string) => void;
}) {
  const [qrOpen, setQrOpen] = useState(false);
  const qrValue = JSON.stringify({ shift_id: shift.id, token: shift.qr_token });

  return (
    <>
      <tr className="hover:bg-muted">
        <td className="px-6 py-4 text-sm font-medium text-foreground">{formatDate(shift.date)}</td>
        <td className="px-6 py-4 text-sm text-foreground">{SHIFT_TYPE_LABELS[shift.shift_type] || shift.shift_type}</td>
        <td className="px-6 py-4 text-sm text-muted-foreground font-mono">{shift.start_time?.slice(0, 5)} — {shift.end_time?.slice(0, 5)}</td>
        <td className="px-6 py-4 text-sm text-foreground">{shift.contract_number ? `${shift.contract_number}` : '—'}</td>
        <td className="px-6 py-4 text-sm text-foreground">{shift.contractor_name || '—'}</td>
        <td className="px-6 py-4 text-sm text-center text-foreground">{shift.registrations_count}</td>
        <td className="px-6 py-4 text-sm text-center text-foreground">{shift.teams_count}</td>
        <td className="px-6 py-4">
          <Badge className={cn('text-xs', SHIFT_STATUS_STYLES[shift.status] || 'bg-muted text-muted-foreground')}>
            {shift.status === 'active' ? 'Активна' : shift.status === 'scheduled' ? 'Запланирована' : 'Закрыта'}
          </Badge>
        </td>
        {(onActivate || onClose) && (
          <td className="px-6 py-4">
            <div className="flex items-center gap-2">
              {shift.status === 'active' && shift.qr_token && (
                <Button size="sm" variant="outline" onClick={() => setQrOpen(true)} className="text-primary border-blue-300 hover:bg-primary/10" aria-label="Показать QR-код смены" tabIndex={0}>
                  <QrCode className="w-3.5 h-3.5 mr-1" /> QR
                </Button>
              )}
              {shift.status === 'scheduled' && onActivate && (
                <Button size="sm" variant="outline" onClick={() => onActivate(shift.id)} className="text-green-600 border-green-300 hover:bg-green-50 dark:bg-green-900/20" aria-label="Активировать смену" tabIndex={0}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Активировать
                </Button>
              )}
              {shift.status === 'active' && onClose && (
                <Button size="sm" variant="outline" onClick={() => onClose(shift.id)} className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 dark:bg-red-900/20" aria-label="Закрыть смену" tabIndex={0}>
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Закрыть
                </Button>
              )}
            </div>
          </td>
        )}
      </tr>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>QR-код смены</DialogTitle>
            <DialogDescription>Покажите этот QR-код монтажникам для регистрации на смену</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
              <QRCodeSVG value={qrValue} size={256} level="M" includeMargin />
            </div>
            <div className="text-center text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">{formatDate(shift.date)} · {SHIFT_TYPE_LABELS[shift.shift_type] || shift.shift_type}</p>
              <p>{shift.start_time?.slice(0, 5)} — {shift.end_time?.slice(0, 5)}</p>
              {shift.contractor_name && <p>{shift.contractor_name}</p>}
              {shift.contract_number && <p>Договор: {shift.contract_number}</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface ShiftsSectionProps {
  objectId: number;
  data: PaginatedResponse<WorklogShift> | undefined;
  isLoading: boolean;
  page: number;
  onPageChange: (p: number) => void;
  statusFilter: string;
  onStatusFilterChange: (f: string) => void;
}

export function ShiftsSection({ objectId, data, isLoading, page, onPageChange, statusFilter, onStatusFilterChange }: ShiftsSectionProps) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [shiftDate, setShiftDate] = useState(new Date().toISOString().slice(0, 10));
  const [shiftType, setShiftType] = useState('day');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('18:00');
  const [selectedContract, setSelectedContract] = useState('');

  const { data: contractsData } = useQuery({
    queryKey: ['object-contracts-for-shift', objectId],
    queryFn: () => api.contracts.getContracts({ object: objectId, contract_type: 'expense', page_size: 100 }),
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
    enabled: createOpen,
  });
  const contracts = contractsData?.results || [];

  const createMutation = useMutation({
    mutationFn: () => api.worklog.createWorklogShift({ contract: parseInt(selectedContract), date: shiftDate, shift_type: shiftType, start_time: startTime + ':00', end_time: endTime + ':00' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['worklog-shifts'] }); queryClient.invalidateQueries({ queryKey: ['work-journal-summary'] }); setCreateOpen(false); toast.success('Смена создана'); },
    onError: () => toast.error('Ошибка при создании смены'),
  });

  const activateMutation = useMutation({
    mutationFn: (shiftId: string) => api.worklog.activateWorklogShift(shiftId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['worklog-shifts'] }); queryClient.invalidateQueries({ queryKey: ['work-journal-summary'] }); toast.success('Смена активирована'); },
    onError: () => toast.error('Ошибка при активации смены'),
  });

  const closeMutation = useMutation({
    mutationFn: (shiftId: string) => api.worklog.closeWorklogShift(shiftId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['worklog-shifts'] }); queryClient.invalidateQueries({ queryKey: ['work-journal-summary'] }); toast.success('Смена закрыта'); },
    onError: () => toast.error('Ошибка при закрытии смены'),
  });

  const handleCreate = () => { if (!selectedContract) { toast.error('Выберите договор'); return; } createMutation.mutate(); };
  const handleShiftTypeChange = (type: string) => {
    setShiftType(type);
    if (type === 'day') { setStartTime('08:00'); setEndTime('18:00'); }
    else if (type === 'evening') { setStartTime('18:00'); setEndTime('02:00'); }
    else if (type === 'night') { setStartTime('22:00'); setEndTime('08:00'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select className="border border-border rounded-lg px-3 py-1.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring" value={statusFilter} onChange={(e) => { onStatusFilterChange(e.target.value); onPageChange(1); }} aria-label="Фильтр по статусу">
            <option value="">Все статусы</option>
            <option value="active">Активные</option>
            <option value="scheduled">Запланированные</option>
            <option value="closed">Закрытые</option>
          </select>
        </div>
        <Button onClick={() => setCreateOpen(true)} aria-label="Открыть смену" tabIndex={0}><Plus className="w-4 h-4 mr-2" /> Открыть смену</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : !data || data.results.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Нет смен{statusFilter ? ' с выбранным фильтром' : ''}</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Дата</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Тип</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Время</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Договор</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Контрагент</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Регистрации</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Звенья</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Статус</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.results.map((shift) => (
                  <ShiftRow key={shift.id} shift={shift} onActivate={(id) => activateMutation.mutate(id)} onClose={(id) => closeMutation.mutate(id)} />
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar count={data.count} page={page} pageSize={10} onPageChange={onPageChange} />
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Открыть смену</DialogTitle>
            <DialogDescription>Создайте новую рабочую смену на объекте</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label htmlFor="shift-contract">Договор</Label>
              <Select value={selectedContract} onValueChange={setSelectedContract}>
                <SelectTrigger className="mt-1.5" id="shift-contract" aria-label="Выбор договора"><SelectValue placeholder="Выберите договор" /></SelectTrigger>
                <SelectContent>
                  {contracts.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.number} — {c.name} ({c.counterparty_name})</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="shift-date">Дата</Label>
              <Input id="shift-date" type="date" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} className="mt-1.5" aria-label="Дата смены" />
            </div>
            <div>
              <Label htmlFor="shift-type">Тип смены</Label>
              <Select value={shiftType} onValueChange={handleShiftTypeChange}>
                <SelectTrigger className="mt-1.5" id="shift-type" aria-label="Тип смены"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Дневная</SelectItem>
                  <SelectItem value="evening">Вечерняя</SelectItem>
                  <SelectItem value="night">Ночная</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label htmlFor="shift-start">Начало</Label><Input id="shift-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1.5" aria-label="Время начала" /></div>
              <div><Label htmlFor="shift-end">Окончание</Label><Input id="shift-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="mt-1.5" aria-label="Время окончания" /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Отмена</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Создание...</>) : (<><Plus className="w-4 h-4 mr-2" /> Создать смену</>)}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
