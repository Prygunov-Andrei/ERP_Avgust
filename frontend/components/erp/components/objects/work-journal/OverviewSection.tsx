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
      <tr className="hover:bg-gray-50">
        <td className="px-6 py-4 text-sm font-medium text-gray-900">{formatDate(shift.date)}</td>
        <td className="px-6 py-4 text-sm text-gray-700">{SHIFT_TYPE_LABELS[shift.shift_type] || shift.shift_type}</td>
        <td className="px-6 py-4 text-sm text-gray-500 font-mono">{shift.start_time?.slice(0, 5)} — {shift.end_time?.slice(0, 5)}</td>
        <td className="px-6 py-4 text-sm text-gray-700">{shift.contractor_name || '—'}</td>
        <td className="px-6 py-4 text-sm text-center text-gray-700">{shift.registrations_count}</td>
        <td className="px-6 py-4 text-sm text-center text-gray-700">{shift.teams_count}</td>
        <td className="px-6 py-4">
          <Badge className={cn('text-xs', SHIFT_STATUS_STYLES[shift.status] || 'bg-gray-100 text-gray-600')}>
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
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <QRCodeSVG value={qrValue} size={256} level="M" includeMargin />
            </div>
            <div className="text-center text-sm text-gray-500 space-y-1">
              <p className="font-medium text-gray-700">{formatDate(shift.date)} · {SHIFT_TYPE_LABELS[shift.shift_type] || shift.shift_type}</p>
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
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Нет недавних смен</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-base font-semibold text-gray-900">Последние смены</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Время</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Контрагент</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Регистрации</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Звенья</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {shifts.map((shift) => (
              <ShiftOverviewRow key={shift.id} shift={shift} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
