import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { api, ContractListItem } from '@/lib/api';
import { EmptyState } from '../../common/EmptyState';
import { LoadingSpinner } from '../../common/LoadingSpinner';
import { formatCurrency } from '@/lib/utils';
import { CONSTANTS } from '@/constants';

type ObjectReconciliationProps = {
  objectId: number;
  contractType: 'income' | 'expense';
};

type BalanceData = {
  total_acts: string;
  total_paid: string;
  balance: string;
};

export const ObjectReconciliation = ({ objectId, contractType }: ObjectReconciliationProps) => {
  const { data: contractsData, isLoading: contractsLoading } = useQuery({
    queryKey: ['contracts', { object: objectId, contract_type: contractType }],
    queryFn: () => api.contracts.getContracts({ object: objectId, contract_type: contractType }),
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
  });

  const contracts: ContractListItem[] = contractsData?.results || [];

  const { data: balances, isLoading: balancesLoading } = useQuery({
    queryKey: ['contract-balances', objectId, contractType],
    queryFn: async () => {
      if (contracts.length === 0) return [];
      const results = await Promise.all(
        contracts.map(async (c) => {
          try {
            const balance = await api.contracts.getContractBalance(c.id);
            return { contract: c, balance: balance as BalanceData };
          } catch {
            return {
              contract: c,
              balance: { total_acts: '0', total_paid: '0', balance: '0' } as BalanceData,
            };
          }
        })
      );
      return results;
    },
    enabled: contracts.length > 0,
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
  });

  if (contractsLoading || balancesLoading) {
    return <LoadingSpinner text="Загрузка сверок..." />;
  }

  if (!balances || balances.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 className="w-12 h-12 text-muted-foreground" />}
        title="Нет данных для сверки"
        description="Создайте договоры и акты для формирования сверки"
      />
    );
  }

  const totalActs = balances.reduce(
    (sum, b) => sum + parseFloat(b.balance.total_acts || '0'), 0
  );
  const totalPaid = balances.reduce(
    (sum, b) => sum + parseFloat(b.balance.total_paid || '0'), 0
  );
  const totalBalance = totalActs - totalPaid;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">
        {contractType === 'income' ? 'Сверка с Заказчиком' : 'Сверка с Исполнителями'}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <TrendingUp className="w-4 h-4" />
            <span>Сумма актов</span>
          </div>
          <div className="text-xl font-semibold text-foreground">
            {formatCurrency(totalActs.toFixed(2))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <DollarSign className="w-4 h-4" />
            <span>Оплачено</span>
          </div>
          <div className="text-xl font-semibold text-foreground">
            {formatCurrency(totalPaid.toFixed(2))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <TrendingDown className="w-4 h-4" />
            <span>{contractType === 'income' ? 'Дебиторская задолженность' : 'Кредиторская задолженность'}</span>
          </div>
          <div className={`text-xl font-semibold ${totalBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(totalBalance.toFixed(2))}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Договор</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Сумма договора</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">По актам</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Оплачено</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Задолженность</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {balances.map(({ contract, balance }) => {
              const debt = parseFloat(balance.total_acts || '0') - parseFloat(balance.total_paid || '0');
              return (
                <tr key={contract.id} className="hover:bg-muted">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{contract.number}</div>
                    <div className="text-xs text-muted-foreground">{contract.counterparty_name}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-foreground">
                    {formatCurrency(contract.total_amount)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                    {formatCurrency(balance.total_acts)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                    {formatCurrency(balance.total_paid)}
                  </td>
                  <td className={`px-4 py-3 text-right text-sm font-medium ${debt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(debt.toFixed(2))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
