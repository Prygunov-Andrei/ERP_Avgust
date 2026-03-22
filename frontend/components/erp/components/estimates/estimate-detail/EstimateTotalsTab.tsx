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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-6">Итоги по смете</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center py-3 border-b">
            <span className="text-gray-600">Материалы (продажа)</span>
            <span className="font-medium text-gray-900">{formatCurrency(estimate.total_materials_sale)}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b">
            <span className="text-gray-600">Работы (продажа)</span>
            <span className="font-medium text-gray-900">{formatCurrency(estimate.total_works_sale)}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-300">
            <span className="text-lg font-semibold text-gray-900">Итого продажа</span>
            <span className="text-lg font-semibold text-gray-900">{formatCurrency(estimate.total_sale)}</span>
          </div>

          <div className="flex justify-between items-center py-3 border-b">
            <span className="text-gray-600">Материалы (закупка)</span>
            <span className="font-medium text-gray-900">{formatCurrency(estimate.total_materials_purchase)}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b">
            <span className="text-gray-600">Работы (закупка)</span>
            <span className="font-medium text-gray-900">{formatCurrency(estimate.total_works_purchase)}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-300">
            <span className="text-lg font-semibold text-gray-900">Итого закупка</span>
            <span className="text-lg font-semibold text-gray-900">{formatCurrency(estimate.total_purchase)}</span>
          </div>

          <div className="flex justify-between items-center py-3 border-b">
            <span className="text-lg font-semibold text-gray-900">Прибыль</span>
            <div className="text-right">
              <span className={`text-lg font-semibold ${parseFloat(estimate.profit_amount) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(estimate.profit_amount)}
              </span>
              <span className="text-sm text-gray-500 ml-2">({estimate.profit_percent}%)</span>
            </div>
          </div>

          {estimate.with_vat && (
            <>
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-gray-600">НДС ({estimate.vat_rate}%)</span>
                <span className="font-medium text-gray-900">{formatCurrency(estimate.vat_amount)}</span>
              </div>
              <div className="flex justify-between items-center py-4 bg-blue-50 rounded-lg px-4">
                <span className="text-xl font-semibold text-gray-900">Итого с НДС</span>
                <span className="text-xl font-semibold text-blue-600">{formatCurrency(estimate.total_with_vat)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
