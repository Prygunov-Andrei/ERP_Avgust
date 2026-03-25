import { formatCurrency } from '@/lib/utils';

interface EstimateTotalsTabProps {
  estimate: {
    total_materials_sale: string;
    total_works_sale: string;
    total_sale: string;
    total_materials_purchase: string;
    total_works_purchase: string;
    total_purchase: string;
    profit_amount: string;
    profit_percent: string;
    with_vat: boolean;
    vat_rate: string;
    vat_amount: string;
    total_with_vat: string;
  };
}

export function EstimateTotalsTab({ estimate }: EstimateTotalsTabProps) {
  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <h3 className="font-semibold text-foreground mb-6">Итоги по смете</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center py-3 border-b">
            <span className="text-muted-foreground">Материалы (продажа)</span>
            <span className="font-medium text-foreground">{formatCurrency(estimate.total_materials_sale)}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b">
            <span className="text-muted-foreground">Работы (продажа)</span>
            <span className="font-medium text-foreground">{formatCurrency(estimate.total_works_sale)}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-border">
            <span className="text-lg font-semibold text-foreground">Итого продажа</span>
            <span className="text-lg font-semibold text-foreground">{formatCurrency(estimate.total_sale)}</span>
          </div>

          <div className="flex justify-between items-center py-3 border-b">
            <span className="text-muted-foreground">Материалы (закупка)</span>
            <span className="font-medium text-foreground">{formatCurrency(estimate.total_materials_purchase)}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b">
            <span className="text-muted-foreground">Работы (закупка)</span>
            <span className="font-medium text-foreground">{formatCurrency(estimate.total_works_purchase)}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-border">
            <span className="text-lg font-semibold text-foreground">Итого закупка</span>
            <span className="text-lg font-semibold text-foreground">{formatCurrency(estimate.total_purchase)}</span>
          </div>

          <div className="flex justify-between items-center py-3 border-b">
            <span className="text-lg font-semibold text-foreground">Прибыль</span>
            <div className="text-right">
              <span className={`text-lg font-semibold ${parseFloat(estimate.profit_amount) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(estimate.profit_amount)}
              </span>
              <span className="text-sm text-muted-foreground ml-2">({estimate.profit_percent}%)</span>
            </div>
          </div>

          {estimate.with_vat && (
            <>
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-muted-foreground">НДС ({estimate.vat_rate}%)</span>
                <span className="font-medium text-foreground">{formatCurrency(estimate.vat_amount)}</span>
              </div>
              <div className="flex justify-between items-center py-4 bg-primary/10 rounded-lg px-4">
                <span className="text-xl font-semibold text-foreground">Итого с НДС</span>
                <span className="text-xl font-semibold text-primary">{formatCurrency(estimate.total_with_vat)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
