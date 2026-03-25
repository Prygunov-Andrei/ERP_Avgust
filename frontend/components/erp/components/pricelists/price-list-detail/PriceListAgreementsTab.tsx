import type { PriceListAgreement } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { UseMutationResult } from '@tanstack/react-query';

interface PriceListAgreementsTabProps {
  agreements: PriceListAgreement[];
  onAddAgreement: () => void;
  onDeleteAgreement: (agreementId: number) => void;
  deleteAgreementMutation: UseMutationResult<any, any, any, any>;
}

export function PriceListAgreementsTab({ agreements, onAddAgreement, onDeleteAgreement, deleteAgreementMutation }: PriceListAgreementsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onAddAgreement} className="bg-blue-600 hover:bg-blue-700">Добавить согласование</Button>
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted border-b border-border">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Контрагент</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">ИНН</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Дата согласования</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Примечания</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {agreements.length > 0 ? (
              agreements.map((agreement) => (
                <tr key={agreement.id} className="hover:bg-muted">
                  <td className="px-6 py-4"><span className="font-medium text-foreground">{agreement.counterparty_detail.name}</span></td>
                  <td className="px-6 py-4"><span className="text-sm text-muted-foreground">{agreement.counterparty_detail.inn}</span></td>
                  <td className="px-6 py-4"><span className="text-sm text-foreground">{formatDate(agreement.agreed_date)}</span></td>
                  <td className="px-6 py-4"><span className="text-sm text-muted-foreground">{agreement.notes || '—'}</span></td>
                  <td className="px-6 py-4">
                    <Button variant="ghost" size="sm" onClick={() => onDeleteAgreement(agreement.id)} disabled={deleteAgreementMutation.isPending}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">Нет согласований</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
