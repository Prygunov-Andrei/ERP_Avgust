import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@/hooks/erp-router';
import { ClipboardList } from 'lucide-react';
import { api, Act, ContractListItem } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '../../common/EmptyState';
import { LoadingSpinner } from '../../common/LoadingSpinner';
import { formatDate, formatCurrency } from '@/lib/utils';
import { CONSTANTS } from '@/constants';

type ObjectActsListProps = {
  objectId: number;
  contractType: 'income' | 'expense';
};

const ACT_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: 'Черновик', className: 'bg-muted text-foreground' },
  agreed: { label: 'Согласован', className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 dark:text-yellow-400' },
  signed: { label: 'Подписан', className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' },
  cancelled: { label: 'Отменен', className: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400' },
};

const ACT_TYPE_CONFIG: Record<string, string> = {
  ks2: 'КС-2',
  ks3: 'КС-3',
  simple: 'Простой',
};

export const ObjectActsList = ({ objectId, contractType }: ObjectActsListProps) => {
  const navigate = useNavigate();

  const { data: contractsData, isLoading: contractsLoading } = useQuery({
    queryKey: ['contracts', { object: objectId, contract_type: contractType }],
    queryFn: () => api.contracts.getContracts({ object: objectId, contract_type: contractType }),
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
  });

  const contracts: ContractListItem[] = contractsData?.results || [];
  const contractIds = contracts.map((c) => c.id);

  const { data: allActs, isLoading: actsLoading } = useQuery({
    queryKey: ['acts-by-object', objectId, contractType],
    queryFn: async () => {
      if (contractIds.length === 0) return [];
      const results = await Promise.all(
        contractIds.map((cid) => api.contracts.getActs(cid))
      );
      return results.flat();
    },
    enabled: contractIds.length > 0,
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
  });

  if (contractsLoading || actsLoading) {
    return <LoadingSpinner text="Загрузка актов..." />;
  }

  const acts = allActs || [];

  if (acts.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="w-12 h-12 text-muted-foreground" />}
        title="Нет актов"
        description="Акты выполненных работ ещё не созданы"
      />
    );
  }

  const contractMap = new Map(contracts.map((c) => [c.id, c]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Акты выполненных работ</h3>
        <span className="text-sm text-muted-foreground">{acts.length} шт.</span>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Номер</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Тип</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Договор</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Дата</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Сумма</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {acts.map((act) => {
                const statusCfg = ACT_STATUS_CONFIG[act.status] || ACT_STATUS_CONFIG.draft;
                const contract = contractMap.get(act.contract);
                return (
                  <tr
                    key={act.id}
                    onClick={() => navigate(`/contracts/acts/${act.id}`)}
                    className="hover:bg-muted cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{act.number}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {ACT_TYPE_CONFIG[act.act_type] || act.act_type}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {contract?.number || act.contract_number || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(act.date)}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-foreground">
                      {formatCurrency(act.amount_gross)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={statusCfg.className}>{statusCfg.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
