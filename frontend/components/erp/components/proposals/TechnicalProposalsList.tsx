import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@/hooks/erp-router';
import { Plus, Search } from 'lucide-react';
import { api, TechnicalProposalListItem } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CreateTechnicalProposalDialog } from './CreateTechnicalProposalDialog';
import { useObjects, useLegalEntities } from '@/hooks';
import { formatDate, formatCurrency } from '@/lib/utils';
import { CONSTANTS } from '@/constants';

const getDueDateStyle = (dueDate: string | null): string => {
  if (!dueDate) return '';
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'bg-red-50 dark:bg-red-900/20';
  if (diffDays <= 3) return 'bg-orange-50';
  return '';
};

const getDueDateBadge = (dueDate: string | null) => {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return <Badge className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 ml-1 text-[10px]">просрочено</Badge>;
  }
  if (diffDays <= 3) {
    return <Badge className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400 dark:text-orange-400 ml-1 text-[10px]">{diffDays === 0 ? 'сегодня' : `${diffDays} дн.`}</Badge>;
  }
  return null;
};

export function TechnicalProposalsList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [objectFilter, setObjectFilter] = useState('');
  const [legalEntityFilter, setLegalEntityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: tkpData, isLoading } = useQuery({
    queryKey: ['technical-proposals', { search: searchQuery, object: objectFilter, legal_entity: legalEntityFilter, status: statusFilter }],
    queryFn: () => api.proposals.getTechnicalProposals({
      search: searchQuery || undefined,
      object: objectFilter ? parseInt(objectFilter) : undefined,
      legal_entity: legalEntityFilter ? parseInt(legalEntityFilter) : undefined,
      status: statusFilter || undefined,
    }),
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
  });

  const { data: objects } = useObjects();
  const { data: legalEntities } = useLegalEntities();

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: 'Черновик', className: 'bg-muted text-foreground' },
      in_progress: { label: 'В работе', className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400' },
      checking: { label: 'На проверке', className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 dark:text-yellow-400' },
      approved: { label: 'Утверждено', className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' },
      sent: { label: 'Отправлено', className: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400' },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const tkpList = tkpData?.results || [];

  const handleRowClick = (tkp: TechnicalProposalListItem) => {
    navigate(`/proposals/technical-proposals/${tkp.id}`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl">Технико-Коммерческие Предложения</h1>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Создать ТКП
        </Button>
      </div>

      <div className="bg-card p-4 rounded-lg border space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label>Поиск</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Номер или название..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Label>Объект</Label>
            <select
              className="w-full px-3 py-2 border rounded-md"
              value={objectFilter}
              onChange={(e) => setObjectFilter(e.target.value)}
            >
              <option value="">Все объекты</option>
              {objects?.map((obj) => (
                <option key={obj.id} value={obj.id}>{obj.name}</option>
              ))}
            </select>
          </div>

          <div>
            <Label>Компания</Label>
            <select
              className="w-full px-3 py-2 border rounded-md"
              value={legalEntityFilter}
              onChange={(e) => setLegalEntityFilter(e.target.value)}
            >
              <option value="">Все компании</option>
              {legalEntities?.map((entity) => (
                <option key={entity.id} value={entity.id}>{entity.name}</option>
              ))}
            </select>
          </div>

          <div>
            <Label>Статус</Label>
            <select
              className="w-full px-3 py-2 border rounded-md"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Все статусы</option>
              <option value="draft">Черновик</option>
              <option value="in_progress">В работе</option>
              <option value="checking">На проверке</option>
              <option value="approved">Утверждено</option>
              <option value="sent">Отправлено</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setObjectFilter('');
              setLegalEntityFilter('');
              setStatusFilter('');
            }}
          >
            Сбросить фильтры
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Номер</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Название</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Создано</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Дата выдачи</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Объект</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Компания</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Статус</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Сумма</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Версия</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    Загрузка...
                  </td>
                </tr>
              ) : tkpList.length > 0 ? (
                tkpList.map((tkp) => (
                  <tr
                    key={tkp.id}
                    className={`hover:bg-muted cursor-pointer transition-colors ${getDueDateStyle(tkp.due_date)}`}
                    onClick={() => handleRowClick(tkp)}
                    role="link"
                    tabIndex={0}
                    aria-label={`Открыть ТКП ${tkp.number}`}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRowClick(tkp); }}
                  >
                    <td className="px-4 py-3">
                      <span className="text-primary font-medium">{tkp.number}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-xs truncate">{tkp.name}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-sm">{formatDate(tkp.created_at)}</td>
                    <td className="px-4 py-3 text-sm">
                      {tkp.due_date ? (
                        <span className="flex items-center gap-1">
                          {formatDate(tkp.due_date)}
                          {getDueDateBadge(tkp.due_date)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-xs truncate text-muted-foreground">{tkp.object_name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-xs truncate text-muted-foreground">{tkp.legal_entity_name}</div>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(tkp.status)}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(tkp.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm text-muted-foreground">v{tkp.version_number}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    Нет данных
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {tkpData && tkpData.count > 0 && (
          <div className="px-4 py-3 border-t bg-muted">
            <div className="text-sm text-muted-foreground">
              Всего: {tkpData.count} ТКП
            </div>
          </div>
        )}
      </div>

      <CreateTechnicalProposalDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
}
