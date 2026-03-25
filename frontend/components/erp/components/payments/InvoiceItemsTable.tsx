import { InvoiceItem } from '@/lib/api';
import { formatAmount } from '@/lib/utils';

interface InvoiceItemsTableProps {
  items: InvoiceItem[];
  readonly?: boolean;
}

export function InvoiceItemsTable({ items, readonly = false }: InvoiceItemsTableProps) {
  // Рассчитываем сумму для каждой позиции
  const itemsWithAmounts = items.map(item => {
    const quantity = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.price_per_unit) || 0;
    const amount = (quantity * price).toFixed(2);
    return { ...item, amount };
  });

  // Рассчитываем итого
  const total = itemsWithAmounts.reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="bg-muted px-4 py-3 border-b border-border">
        <h3 className="font-medium text-sm">Позиции счёта</h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted border-b border-border">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-foreground w-12">№</th>
              <th className="px-4 py-2 text-left font-medium text-foreground">Наименование</th>
              <th className="px-4 py-2 text-right font-medium text-foreground w-24">Кол-во</th>
              <th className="px-4 py-2 text-center font-medium text-foreground w-20">Ед.изм.</th>
              <th className="px-4 py-2 text-right font-medium text-foreground w-32">Цена</th>
              <th className="px-4 py-2 text-right font-medium text-foreground w-32">Сумма</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {itemsWithAmounts.map((item, index) => (
              <tr key={index} className="hover:bg-muted">
                <td className="px-4 py-3 text-muted-foreground">{index + 1}</td>
                <td className="px-4 py-3 text-foreground">{item.raw_name}</td>
                <td className="px-4 py-3 text-right text-foreground">{item.quantity}</td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">{item.unit}</td>
                <td className="px-4 py-3 text-right text-foreground">
                  {formatAmount(item.price_per_unit)} ₽
                </td>
                <td className="px-4 py-3 text-right font-medium text-foreground">
                  {formatAmount(item.amount)} ₽
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted border-t-2 border-border">
            <tr>
              <td colSpan={5} className="px-4 py-3 text-right font-medium text-foreground">
                Итого:
              </td>
              <td className="px-4 py-3 text-right font-bold text-foreground">
                {formatAmount(total)} ₽
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
