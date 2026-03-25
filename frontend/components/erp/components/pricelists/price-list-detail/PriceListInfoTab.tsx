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
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <h3 className="font-semibold text-foreground mb-4">Общая информация</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><div className="text-sm text-muted-foreground">Номер</div><div className="font-medium text-foreground">{priceList.number}</div></div>
          <div><div className="text-sm text-muted-foreground">Название</div><div className="font-medium text-foreground">{priceList.name || '—'}</div></div>
          <div><div className="text-sm text-muted-foreground">Дата</div><div className="font-medium text-foreground">{formatDate(priceList.date)}</div></div>
          <div><div className="text-sm text-muted-foreground">Статус</div><div>{getStatusBadge(priceList.status, priceList.status_display)}</div></div>
          <div><div className="text-sm text-muted-foreground">Версия</div><div className="font-medium text-foreground">v{priceList.version_number}</div></div>
          <div><div className="text-sm text-muted-foreground">Создан</div><div className="font-medium text-foreground">{formatDate(priceList.created_at)}</div></div>
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <h3 className="font-semibold text-foreground mb-4">Ставки по разрядам</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((grade) => (
            <div key={grade}><div className="text-sm text-muted-foreground">Разряд {grade}</div><div className="font-medium text-foreground">{getGradeRate(grade)}</div></div>
          ))}
        </div>
      </div>
    </div>
  );
}
