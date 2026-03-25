import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@/hooks/erp-router';
import { FileText, Plus, ExternalLink } from 'lucide-react';
import { api, ContractListItem } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '../../common/EmptyState';
import { LoadingSpinner } from '../../common/LoadingSpinner';
import { formatDate, formatCurrency } from '@/lib/utils';
import { CONSTANTS } from '@/constants';

type ObjectContractsListProps = {
  objectId: number;
  contractType: 'income' | 'expense';
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  planned: { label: 'Планируется', className: 'bg-muted text-foreground' },
  agreed: { label: 'Согласован', className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 dark:text-yellow-400' },
  active: { label: 'В работе', className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' },
  completed: { label: 'Завершён', className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400' },
  suspended: { label: 'Приостановлен', className: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400 dark:text-orange-400' },
  terminated: { label: 'Расторгнут', className: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400' },
};

export const ObjectContractsList = ({ objectId, contractType }: ObjectContractsListProps) => {
  const navigate = useNavigate();

  const { data: contractsData, isLoading } = useQuery({
    queryKey: ['contracts', { object: objectId, contract_type: contractType }],
    queryFn: () => api.contracts.getContracts({ object: objectId, contract_type: contractType }),
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
  });

  if (isLoading) return <LoadingSpinner text="Загрузка договоров..." />;

  const contracts: ContractListItem[] = contractsData?.results || [];

  if (contracts.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="w-12 h-12 text-muted-foreground" />}
        title="Нет договоров"
        description={
          contractType === 'income'
            ? 'Договоры с Заказчиком по этому объекту ещё не созданы'
            : 'Договоры с Исполнителями по этому объекту ещё не созданы'
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          {contractType === 'income' ? 'Договоры с Заказчиком' : 'Договоры с Исполнителями'}
        </h3>
        <span className="text-sm text-muted-foreground">{contracts.length} шт.</span>
      </div>

      <div className="space-y-3">
        {contracts.map((contract) => {
          const statusCfg = STATUS_CONFIG[contract.status] || STATUS_CONFIG.planned;
          return (
            <div
              key={contract.id}
              role="button"
              tabIndex={0}
              aria-label={`Договор ${contract.number}`}
              onClick={() => navigate(`/contracts/${contract.id}`)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/contracts/${contract.id}`)}
              className="bg-card border border-border rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-foreground truncate">{contract.number}</span>
                    <Badge className={statusCfg.className}>{statusCfg.label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{contract.name}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>{contract.counterparty_name}</span>
                    <span>{formatDate(contract.contract_date)}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold text-foreground">
                    {formatCurrency(contract.total_amount)}
                  </div>
                  <div className="text-xs text-muted-foreground">{contract.currency}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
