import { useState } from 'react';
import { useNavigate } from '@/hooks/erp-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Account, LegalEntity, CreateAccountData } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { CreditCard, Loader2, Plus, MoreVertical, Pencil, Trash2, Check, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { formatAmount } from '@/lib/utils';
import { CONSTANTS } from '@/constants';
import { AccountForm } from './AccountForm';

export function AccountsTab() {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const queryClient = useQueryClient();

  const { data: accounts, isLoading, error } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.core.getAccounts(),
    staleTime: CONSTANTS.REFERENCE_STALE_TIME_MS,
  });

  const { data: entities } = useQuery({
    queryKey: ['legal-entities'],
    queryFn: () => api.core.getLegalEntities(),
    staleTime: CONSTANTS.REFERENCE_STALE_TIME_MS,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateAccountData) => api.core.createAccount(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setIsDialogOpen(false);
      toast.success('Счет успешно создан');
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateAccountData> }) =>
      api.core.updateAccount(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setEditingAccount(null);
      toast.success('Счет успешно обновлен');
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.core.deleteAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setDeletingAccount(null);
      toast.success('Счет успешно удален');
    },
    onError: (error: Error) => {
      if (error.message.includes('Cannot delete') || error.message.includes('связанные')) {
        toast.error('Нельзя удалить счет, по которому есть операции');
      } else {
        toast.error(`Ошибка: ${error.message}`);
      }
      setDeletingAccount(null);
    },
  });

  const fetchBankBalanceMutation = useMutation({
    mutationFn: (bankAccountId: number) => api.core.fetchBankBalance(bankAccountId),
    onSuccess: (data) => {
      if (data?.status !== 'ok') {
        toast.error(data?.message || 'Не удалось получить остаток из банка');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Остаток из банка обновлён');
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message || 'Не удалось получить остаток из банка'}`);
    },
  });

  const getAccountTypeLabel = (type?: string) => {
    switch (type) {
      case 'bank_account': return 'Расчётный счёт';
      case 'cash': return 'Касса';
      case 'deposit': return 'Депозит';
      case 'currency_account': return 'Валютный счёт';
      default: return 'Не указан';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl">
        Ошибка загрузки: {(error as Error).message}
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-muted-foreground">
          {accounts?.length || 0} {accounts?.length === 1 ? 'счет' : 'счетов'}
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Добавить счет
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Новый счет</DialogTitle>
            <DialogDescription>Введите информацию о банковском счете</DialogDescription>
          </DialogHeader>
          <AccountForm
            entities={entities || []}
            onSubmit={(data) => createMutation.mutate(data)}
            isLoading={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingAccount} onOpenChange={(open) => !open && setEditingAccount(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редактировать счет</DialogTitle>
            <DialogDescription>Измените информацию о банковском счете</DialogDescription>
          </DialogHeader>
          {editingAccount && (
            <AccountForm
              account={editingAccount}
              entities={entities || []}
              onSubmit={(data) => updateMutation.mutate({ id: editingAccount.id, data })}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingAccount} onOpenChange={(open) => !open && setDeletingAccount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Счет "{deletingAccount?.name}" будет удален навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingAccount && deleteMutation.mutate(deletingAccount.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!accounts || accounts.length === 0 ? (
        <div className="bg-muted border-2 border-dashed border-border rounded-xl p-12 text-center">
          <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">Нет счетов</p>
          <Button onClick={() => setIsDialogOpen(true)} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Добавить первый счет
          </Button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Юрлицо
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Название
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Тип
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Банк
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Номер
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Валюта
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Внутр.
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Банк
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Δ
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Активен
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {accounts.map((account: Account) => (
                  <tr
                    key={account.id}
                    className="hover:bg-muted transition-colors cursor-pointer"
                    onClick={() => navigate(`/settings/accounts/${account.id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-foreground">{account.legal_entity_name || '—'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-foreground">{account.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-primary rounded">
                        {getAccountTypeLabel(account.account_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-foreground">{account.bank_name || '—'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-foreground font-mono">
                        {account.account_number || account.number || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-muted text-foreground rounded">
                        {account.currency}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-bold text-foreground">
                        {formatAmount(account.current_balance || account.initial_balance || account.balance)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-bold text-foreground">
                        {account.bank_balance_latest ? formatAmount(account.bank_balance_latest) : '—'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {account.bank_balance_date ? account.bank_balance_date : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-bold text-foreground">
                        {account.bank_delta ? formatAmount(account.bank_delta) : '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {account.is_active !== false ? (
                        <Check className="w-5 h-5 text-green-600 mx-auto" />
                      ) : (
                        <X className="w-5 h-5 text-muted-foreground mx-auto" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              if (!account.bank_account_id) {
                                toast.error('Счёт не привязан к банку (нет BankAccount)');
                                return;
                              }
                              fetchBankBalanceMutation.mutate(account.bank_account_id);
                            }}
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Получить остаток из банка
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditingAccount(account)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Редактировать
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeletingAccount(account)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
