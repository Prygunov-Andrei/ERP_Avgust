import type { PriceListDetail } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';

interface PriceListInfoTabProps {
  priceList: PriceListDetail;
  getStatusBadge: (status: string, statusDisplay: string) => React.ReactNode;
  getGradeRate: (grade: number) => string;
}

export function PriceListInfoTab({ priceList, getStatusBadge, getGradeRate }: PriceListInfoTabProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Общая информация</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><div className="text-sm text-gray-500">Номер</div><div className="font-medium text-gray-900">{priceList.number}</div></div>
          <div><div className="text-sm text-gray-500">Название</div><div className="font-medium text-gray-900">{priceList.name || '—'}</div></div>
          <div><div className="text-sm text-gray-500">Дата</div><div className="font-medium text-gray-900">{formatDate(priceList.date)}</div></div>
          <div><div className="text-sm text-gray-500">Статус</div><div>{getStatusBadge(priceList.status, priceList.status_display)}</div></div>
          <div><div className="text-sm text-gray-500">Версия</div><div className="font-medium text-gray-900">v{priceList.version_number}</div></div>
          <div><div className="text-sm text-gray-500">Создан</div><div className="font-medium text-gray-900">{formatDate(priceList.created_at)}</div></div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Ставки по разрядам</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((grade) => (
            <div key={grade}><div className="text-sm text-gray-500">Разряд {grade}</div><div className="font-medium text-gray-900">{getGradeRate(grade)}</div></div>
          ))}
        </div>
      </div>
    </div>
  );
}
