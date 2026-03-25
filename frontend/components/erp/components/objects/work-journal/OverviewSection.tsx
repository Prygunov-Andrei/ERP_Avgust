import { useState } from 'react';
import { WorklogShift } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Clock, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { SHIFT_TYPE_LABELS, SHIFT_STATUS_STYLES } from './constants';

function ShiftOverviewRow({ shift }: { shift: WorklogShift }) {
  const [qrOpen, setQrOpen] = useState(false);
  const qrValue = JSON.stringify({ shift_id: shift.id, token: shift.qr_token });

  return (
    <>
      <tr className="hover:bg-muted">
        <td className="px-6 py-4 text-sm font-medium text-foreground">{formatDate(shift.date)}</td>
        <td className="px-6 py-4 text-sm text-foreground">{SHIFT_TYPE_LABELS[shift.shift_type] || shift.shift_type}</td>
        <td className="px-6 py-4 text-sm text-muted-foreground font-mono">{shift.start_time?.slice(0, 5)} — {shift.end_time?.slice(0, 5)}</td>
        <td className="px-6 py-4 text-sm text-foreground">{shift.contractor_name || '—'}</td>
        <td className="px-6 py-4 text-sm text-center text-foreground">{shift.registrations_count}</td>
        <td className="px-6 py-4 text-sm text-center text-foreground">{shift.teams_count}</td>
        <td className="px-6 py-4">
          <Badge className={cn('text-xs', SHIFT_STATUS_STYLES[shift.status] || 'bg-muted text-muted-foreground')}>
            {shift.status === 'active' ? 'Активна' : shift.status === 'scheduled' ? 'Запланирована' : 'Закрыта'}
          </Badge>
        </td>
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

export function OverviewSection({ shifts }: { shifts: WorklogShift[] }) {
  if (!shifts || shifts.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Нет недавних смен</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-base font-semibold text-foreground">Последние смены</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted border-b border-border">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Дата</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Тип</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Время</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Контрагент</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Регистрации</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Звенья</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shifts.map((shift) => (
              <ShiftOverviewRow key={shift.id} shift={shift} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
