import { TrendingUp, TrendingDown, FileText, CheckCircle, DollarSign, Wallet, ArrowRight, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNavigate } from '@/hooks/erp-router';
import { CONSTANTS, COLORS, LOCALE } from '@/constants';
import { formatDate, formatAmount, formatCurrency, formatThousands } from '@/lib/utils';

// Время кеширования данных Dashboard (5 минут)
const DASHBOARD_STALE_TIME = CONSTANTS.QUERY_STALE_TIME_MS;

export function Dashboard() {
  const navigate = useNavigate();

  // Загрузка данных аналитики с кешированием
  const { data: cashFlowData, isLoading: cashFlowLoading } = useQuery({
    queryKey: ['cashflow'],
    queryFn: () => api.payments.getCashFlow('year'),
    retry: false,
    staleTime: DASHBOARD_STALE_TIME,
  });

  const { data: debtData, isLoading: debtLoading } = useQuery({
    queryKey: ['debt-summary'],
    queryFn: () => api.payments.getDebtSummary(),
    retry: false,
    staleTime: DASHBOARD_STALE_TIME,
  });

  // ОПТИМИЗАЦИЯ: Один запрос вместо 5 отдельных для получения всех договоров
  const { data: allContractsData } = useQuery({
    queryKey: ['contracts-dashboard'],
    queryFn: () => api.contracts.getContracts({ page_size: CONSTANTS.MAX_PAGE_SIZE }),
    retry: false,
    staleTime: DASHBOARD_STALE_TIME,
  });

  // Загрузка последних договоров (отдельный запрос, т.к. нужна сортировка)
  const { data: recentContracts } = useQuery({
    queryKey: ['recent-contracts'],
    queryFn: () => api.contracts.getContracts({ ordering: '-contract_date', page_size: CONSTANTS.RECENT_ITEMS_COUNT }),
    retry: false,
    staleTime: DASHBOARD_STALE_TIME,
  });

  // Загрузка счетов
  const { data: accountsData } = useQuery({
    queryKey: ['accounts-active'],
    queryFn: () => api.core.getAccounts({ is_active: true }),
    retry: false,
    staleTime: DASHBOARD_STALE_TIME,
  });

  // Загрузка последних платежей
  const { data: recentPayments } = useQuery({
    queryKey: ['recent-payments'],
    queryFn: () => api.payments.getPayments({ ordering: '-payment_date', page_size: CONSTANTS.RECENT_ITEMS_COUNT }),
    retry: false,
    staleTime: DASHBOARD_STALE_TIME,
  });

  // ОПТИМИЗАЦИЯ: Используем общий запрос из NotificationBadge для истекающих договоров
  const { data: expiringContracts } = useQuery({
    queryKey: ['notification-expiring-contracts'],
    queryFn: async () => {
      const now = new Date();
      const thirtyDaysLater = new Date();
      thirtyDaysLater.setDate(now.getDate() + CONSTANTS.CONTRACT_EXPIRY_WARNING_DAYS);
      
      const contracts = await api.contracts.getContracts({ status: 'active', page_size: 100 });
      
      // Фильтруем договоры с end_date в ближайшие 30 дней
      if (contracts.results) {
        return contracts.results.filter((contract) => {
          if (!contract.end_date) return false;
          const endDate = new Date(contract.end_date);
          return endDate >= now && endDate <= thirtyDaysLater;
        });
      }
      return [];
    },
    retry: false,
    staleTime: DASHBOARD_STALE_TIME,
  });

  const safeGetNumber = (value: unknown): number => {
    if (value === null || value === undefined) {
      return 0;
    }
    if (typeof value === 'string') {
      return parseFloat(value) || 0;
    }
    if (typeof value === 'number') {
      return value;
    }
    return 0;
  };

  // ОПТИМИЗАЦИЯ: Вычисление метрик из одного запроса
  const allContracts = allContractsData?.results || [];
  const totalContracts = allContractsData?.count || 0;
  const activeContracts = allContracts.filter((c) => c.status === 'active').length;
  
  const totalContractsSum = allContracts.reduce(
    (sum, contract) => sum + safeGetNumber(contract.total_amount), 
    0
  );

  const totalAccountsBalance = Array.isArray(accountsData) 
    ? accountsData.reduce((sum, account) => sum + safeGetNumber(account.current_balance), 0)
    : 0;

  const totalReceivables = safeGetNumber(debtData?.total_receivables);
  const totalPayables = safeGetNumber(debtData?.total_payables);

  // Подготовка данных для графика Cash Flow
  const cashFlowChartData = Array.isArray(cashFlowData) 
    ? cashFlowData.map(item => ({
        month: item.month,
        Приход: safeGetNumber(item.income),
        Расход: safeGetNumber(item.expense),
      }))
    : [];

  // Подготовка данных для Pie Chart
  const debtChartData = debtData ? [
    { name: 'Нам должны', value: totalReceivables, color: COLORS.CHART_INCOME },
    { name: 'Мы должны', value: totalPayables, color: COLORS.CHART_EXPENSE },
  ].filter(item => item.value > 0) : [];

  const getStatusBadgeClass = (status: string) => {
    const statusMap: Record<string, string> = {
      active: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400',
      draft: 'bg-muted text-foreground',
      completed: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400',
      cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400',
      pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 dark:text-yellow-400',
      approved: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400',
      rejected: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400',
    };
    return statusMap[status] || 'bg-muted text-foreground';
  };

  const getStatusLabel = (status: string) => {
    const statusLabels: Record<string, string> = {
      active: 'Активен',
      draft: 'Черновик',
      completed: 'Завершен',
      cancelled: 'Отменен',
      pending: 'Ожидает',
      approved: 'Согласован',
      rejected: 'Отклонен',
    };
    return statusLabels[status] || status;
  };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-2xl text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Общая статистика и последние операции</p>
        </div>

        {/* Метрики - Карточки */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Всего договоров */}
          <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground">Всего договоров</div>
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div className="text-3xl text-foreground mb-1">
              {totalContracts}
            </div>
            <div className="text-xs text-muted-foreground">Все договоры в системе</div>
          </div>

          {/* Активных договоров */}
          <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground">Активных договоров</div>
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-3xl text-foreground mb-1">
              {activeContracts}
            </div>
            <div className="text-xs text-muted-foreground">Договоры со статусом "Активен"</div>
          </div>

          {/* Общая сумма договоров */}
          <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground">Общая сумма договоров</div>
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-3xl text-foreground mb-1">
              {formatThousands(totalContractsSum)} <span className="text-lg">тыс. ₽</span>
            </div>
            <div className="text-xs text-muted-foreground">Сумма всех договоров</div>
          </div>

          {/* Дебиторская задолженность */}
          <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground">Нам должны</div>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-3xl text-green-600 mb-1">
              {formatThousands(totalReceivables)} <span className="text-lg">тыс. ₽</span>
            </div>
            <div className="text-xs text-muted-foreground">Дебиторская задолженность</div>
          </div>

          {/* Кредиторская задолженность */}
          <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground">Мы должны</div>
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <div className="text-3xl text-red-600 mb-1">
              {formatThousands(totalPayables)} <span className="text-lg">тыс. ₽</span>
            </div>
            <div className="text-xs text-muted-foreground">Кредиторская задолженность</div>
          </div>

          {/* Остаток на счетах */}
          <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground">Остаток на счетах</div>
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div className="text-3xl text-foreground mb-1">
              {formatThousands(totalAccountsBalance)} <span className="text-lg">тыс. ₽</span>
            </div>
            <div className="text-xs text-muted-foreground">Сумма всех активных счетов</div>
          </div>
        </div>

        {/* Графики */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Cash Flow Chart */}
          <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
            <h3 className="text-lg text-foreground mb-4">Денежный поток</h3>
            {cashFlowLoading ? (
              <div className="flex items-center justify-center h-80">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : cashFlowChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={cashFlowChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => `${formatThousands(Number(value))} тыс. ₽`} />
                  <Legend />
                  <Bar dataKey="Приход" fill={COLORS.CHART_INCOME} />
                  <Bar dataKey="Расход" fill={COLORS.CHART_EXPENSE} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-80 text-muted-foreground">
                Нет данных для отображения
              </div>
            )}
          </div>

          {/* Debt Structure Chart */}
          <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
            <h3 className="text-lg text-foreground mb-4">Структура задолженности</h3>
            {debtLoading ? (
              <div className="flex items-center justify-center h-80">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : debtChartData.length > 0 && (totalReceivables > 0 || totalPayables > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={debtChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                    outerRadius={CONSTANTS.PIE_CHART_RADIUS}
                    fill={COLORS.CHART_DEFAULT}
                    dataKey="value"
                  >
                    {debtChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${formatThousands(Number(value))} тыс. ₽`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-80 text-muted-foreground">
                Нет данных для отображения
              </div>
            )}
          </div>
        </div>

        {/* Таблицы последних записей */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Последние платежи */}
          <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg text-foreground">Последние платежи</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/payments')}
                className="text-primary hover:text-primary"
              >
                Все платежи
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            <div className="space-y-3">
              {recentPayments && Array.isArray(recentPayments.results) && recentPayments.results.length > 0 ? (
                recentPayments.results.slice(0, 10).map((payment) => (
                  <div
                    key={payment.id}
                    onClick={() => navigate(`/payments`)}
                    className="flex items-center justify-between p-3 hover:bg-muted rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex-1">
                      <div className="text-sm text-foreground">
                        {payment.contract_display || `Платеж #${payment.id}`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(payment.payment_date)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-foreground">
                        {formatAmount(payment.amount)} ₽
                      </div>
                      <div className={`text-xs px-2 py-0.5 rounded-full inline-block ${getStatusBadgeClass(payment.status)}`}>
                        {getStatusLabel(payment.status)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Нет платежей
                </div>
              )}
            </div>
          </div>

          {/* Последние договоры */}
          <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg text-foreground">Последние договоры</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/contracts')}
                className="text-primary hover:text-primary"
              >
                Все договоры
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            <div className="space-y-3">
              {recentContracts && Array.isArray(recentContracts.results) && recentContracts.results.length > 0 ? (
                recentContracts.results.slice(0, 10).map((contract) => (
                  <div
                    key={contract.id}
                    onClick={() => navigate(`/contracts/${contract.id}`)}
                    className="flex items-center justify-between p-3 hover:bg-muted rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex-1">
                      <div className="text-sm text-foreground">
                        {contract.contract_number}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {contract.counterparty_display || 'Без контрагента'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-foreground">
                        {formatAmount(contract.total_amount)} ₽
                      </div>
                      <div className={`text-xs px-2 py-0.5 rounded-full inline-block ${getStatusBadgeClass(contract.status)}`}>
                        {getStatusLabel(contract.status)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Нет договоров
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Договоры с истекающими сроками */}
        {expiringContracts && expiringContracts.length > 0 && (
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-6 shadow-sm border border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg text-foreground">⚠️ Договоры с истекающими сроками</h3>
              <span className="text-sm text-orange-600">
                Истекают в ближайшие 30 дней
              </span>
            </div>
            <div className="space-y-3">
              {expiringContracts.map((contract) => {
                const daysLeft = Math.ceil((new Date(contract.end_date!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div
                    key={contract.id}
                    onClick={() => navigate(`/contracts/${contract.id}`)}
                    className="flex items-center justify-between p-3 bg-card hover:bg-muted rounded-lg cursor-pointer transition-colors border border-orange-100"
                  >
                    <div className="flex-1">
                      <div className="text-sm text-foreground">
                        {contract.contract_number}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {contract.counterparty_display || 'Без контрагента'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-orange-600">
                        Осталось {daysLeft} {daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        до {formatDate(contract.end_date)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}