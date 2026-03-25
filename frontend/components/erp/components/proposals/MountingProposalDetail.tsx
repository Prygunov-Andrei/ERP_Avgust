import { useState } from 'react';
import { useParams, useNavigate } from '@/hooks/erp-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Pencil,
  Save,
  X,
  Trash2,
  Copy,
  FileText,
  Send,
  Calendar,
  Building2,
  User,
  Clock,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { api, MountingProposalDetail as MPDetailType , unwrapResults, MountingProposalListItem, Counterparty} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { CreateVersionDialog } from './CreateVersionDialog';
import { formatDate, formatDateTime, formatCurrency, getStatusBadgeClass, getStatusLabel } from '@/lib/utils';
import { useCounterparties } from '@/hooks';
import { CONSTANTS } from '@/constants';

type TabType = 'info' | 'conditions';

interface EditFormData {
  name: string;
  date: string;
  counterparty: string;
  total_amount: string;
  man_hours: string;
  notes: string;
  status: string;
}

const MP_STATUS_OPTIONS = [
  { value: 'draft', label: 'Черновик' },
  { value: 'published', label: 'Опубликовано' },
  { value: 'sent', label: 'Отправлено' },
  { value: 'approved', label: 'Утверждено' },
  { value: 'rejected', label: 'Отклонено' },
];

export function MountingProposalDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<EditFormData | null>(null);
  const [isCreateVersionDialogOpen, setIsCreateVersionDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTelegramDialogOpen, setIsTelegramDialogOpen] = useState(false);

  const { data: mp, isLoading } = useQuery({
    queryKey: ['mounting-proposal', id],
    queryFn: () => api.proposals.getMountingProposal(parseInt(id!)),
    enabled: !!id,
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
  });

  const { data: versions } = useQuery({
    queryKey: ['mounting-proposal-versions', id],
    queryFn: () => api.proposals.getMountingProposalVersions(parseInt(id!)),
    enabled: !!id,
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
  });

  const { data: counterpartiesData } = useCounterparties(undefined, { enabled: isEditing });
  const counterparties = unwrapResults(counterpartiesData);

  const updateMutation = useMutation({
    mutationFn: (formData: FormData) => api.proposals.updateMountingProposal(parseInt(id!), formData),
    onSuccess: () => {
      toast.success('МП обновлено');
      queryClient.invalidateQueries({ queryKey: ['mounting-proposal', id] });
      queryClient.invalidateQueries({ queryKey: ['mounting-proposals'] });
      setIsEditing(false);
      setEditFormData(null);
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.proposals.deleteMountingProposal(parseInt(id!)),
    onSuccess: () => {
      toast.success('МП удалено');
      navigate('/proposals/mounting-proposals');
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  const publishToTelegramMutation = useMutation({
    mutationFn: () => api.proposals.publishMountingProposalToTelegram(parseInt(id!)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mounting-proposal', id] });
      queryClient.invalidateQueries({ queryKey: ['mounting-proposals'] });
      toast.success('МП опубликовано в Telegram');
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  const handleStartEditing = () => {
    if (!mp) return;
    setEditFormData({
      name: mp.name,
      date: mp.date,
      counterparty: mp.counterparty?.toString() ?? '',
      total_amount: mp.total_amount,
      man_hours: mp.man_hours,
      notes: mp.notes ?? '',
      status: mp.status,
    });
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
    setEditFormData(null);
  };

  const handleSaveEditing = () => {
    if (!editFormData) return;
    const formData = new FormData();
    formData.append('name', editFormData.name);
    formData.append('date', editFormData.date);
    if (editFormData.counterparty) formData.append('counterparty', editFormData.counterparty);
    formData.append('total_amount', editFormData.total_amount);
    formData.append('man_hours', editFormData.man_hours);
    formData.append('notes', editFormData.notes);
    formData.append('status', editFormData.status);
    updateMutation.mutate(formData);
  };

  const handleFieldChange = (field: keyof EditFormData, value: string) => {
    setEditFormData((prev) => (prev ? { ...prev, [field]: value } : null));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  if (!mp) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
        <div className="text-muted-foreground">МП не найдено</div>
        <Button
          onClick={() => navigate('/proposals/mounting-proposals')}
          className="mt-4 bg-blue-600 text-white hover:bg-blue-700"
        >
          Вернуться к списку
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Хедер */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4">
            <Button
              onClick={() => navigate('/proposals/mounting-proposals')}
              className="bg-muted text-foreground hover:bg-muted px-3"
              aria-label="Вернуться к списку МП"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-2">
                {isEditing && editFormData ? (
                  <Input
                    value={editFormData.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    className="text-lg font-semibold w-96"
                    aria-label="Название МП"
                  />
                ) : (
                  <h1 className="text-foreground">{mp.name}</h1>
                )}
                <Badge className={getStatusBadgeClass(mp.status)}>{getStatusLabel(mp.status)}</Badge>
                {mp.telegram_published && (
                  <Badge className="bg-green-50 text-green-700 border border-green-200 dark:border-green-800">
                    <Send className="w-3 h-3 mr-1" />
                    Опубликовано в Telegram
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-muted-foreground">
                <span>№ {mp.number}</span>
                <span>Версия {mp.version_number}</span>
                <span>от {formatDate(mp.date)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {!mp.telegram_published && mp.status === 'published' && !isEditing && (
              <Button
                onClick={() => setIsTelegramDialogOpen(true)}
                className="bg-green-600 text-white hover:bg-green-700"
              >
                <Send className="w-4 h-4 mr-2" />
                Опубликовать в Telegram
              </Button>
            )}
            {isEditing ? (
              <>
                <Button
                  onClick={handleSaveEditing}
                  disabled={updateMutation.isPending}
                  className="bg-green-600 text-white hover:bg-green-700"
                  aria-label="Сохранить изменения"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateMutation.isPending ? 'Сохранение...' : 'Сохранить'}
                </Button>
                <Button
                  onClick={handleCancelEditing}
                  className="bg-muted text-foreground hover:bg-muted"
                  aria-label="Отменить редактирование"
                >
                  <X className="w-4 h-4 mr-2" />
                  Отмена
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={handleStartEditing}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                  aria-label="Редактировать МП"
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Редактировать
                </Button>
                <Button
                  onClick={() => setIsCreateVersionDialogOpen(true)}
                  className="bg-purple-600 text-white hover:bg-purple-700"
                  aria-label="Создать новую версию"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Создать версию
                </Button>
                <Button
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="bg-red-600 text-white hover:bg-red-700"
                  aria-label="Удалить МП"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Вкладки */}
        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-4 py-2 -mb-px transition-colors ${
              activeTab === 'info'
                ? 'border-b-2 border-blue-600 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Основная информация
          </button>
          <button
            onClick={() => setActiveTab('conditions')}
            className={`px-4 py-2 -mb-px transition-colors ${
              activeTab === 'conditions'
                ? 'border-b-2 border-blue-600 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Условия ({mp.conditions.length})
          </button>
        </div>
      </div>

      {/* Контент вкладок */}
      {activeTab === 'info' && (
        <InfoTab
          mp={mp}
          versions={versions}
          isEditing={isEditing}
          editFormData={editFormData}
          onFieldChange={handleFieldChange}
          counterparties={counterparties}
        />
      )}
      {activeTab === 'conditions' && <ConditionsTab mp={mp} />}

      {/* Диалог создания версии */}
      <CreateVersionDialog
        open={isCreateVersionDialogOpen}
        onOpenChange={setIsCreateVersionDialogOpen}
        itemId={mp.id}
        itemType="mp"
        currentDate={mp.date}
        currentVersionNumber={mp.version_number}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить МП</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить МП &quot;{mp.name}&quot;? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isTelegramDialogOpen} onOpenChange={setIsTelegramDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Публикация в Telegram</AlertDialogTitle>
            <AlertDialogDescription>
              Опубликовать МП {mp.number} в Telegram?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => publishToTelegramMutation.mutate()}>
              Опубликовать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Вкладка «Основная информация» ───────────────────────────────────────────

interface InfoTabProps {
  mp: MPDetailType;
  versions?: MountingProposalListItem[];
  isEditing: boolean;
  editFormData: EditFormData | null;
  onFieldChange: (field: keyof EditFormData, value: string) => void;
  counterparties: Counterparty[];
}

function InfoTab({ mp, versions, isEditing, editFormData, onFieldChange, counterparties }: InfoTabProps) {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Основная информация */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h2 className="text-foreground mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Основная информация
        </h2>
        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground">Объект</Label>
            <div className="mt-1 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <div className="text-foreground">{mp.object_name}</div>
            </div>
          </div>

          <div>
            <Label className="text-muted-foreground">Контрагент (Исполнитель)</Label>
            {isEditing && editFormData ? (
              <select
                value={editFormData.counterparty}
                onChange={(e) => onFieldChange('counterparty', e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Выбор исполнителя"
              >
                <option value="">— Не указан —</option>
                {counterparties.map((cp) => (
                  <option key={cp.id} value={cp.id}>{cp.name}</option>
                ))}
              </select>
            ) : (
              <div className="mt-1 text-foreground">
                {mp.counterparty_name ?? <span className="text-muted-foreground">—</span>}
              </div>
            )}
          </div>

          {mp.parent_tkp && (
            <div>
              <Label className="text-muted-foreground">Связанное ТКП</Label>
              <div className="mt-1">
                <button
                  onClick={() => navigate(`/proposals/technical-proposals/${mp.parent_tkp}`)}
                  className="text-primary hover:underline flex items-center gap-2"
                  aria-label={`Открыть ТКП ${mp.parent_tkp_number}`}
                >
                  {mp.parent_tkp_number} - {mp.parent_tkp_name}
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {mp.mounting_estimates && mp.mounting_estimates.length > 0 && (
            <div>
              <Label className="text-muted-foreground">Монтажные сметы ({mp.mounting_estimates.length})</Label>
              <div className="mt-1 space-y-1">
                {mp.mounting_estimates.map((meId: number) => (
                  <button
                    key={meId}
                    onClick={() => navigate(`/estimates/mounting-estimates/${meId}`)}
                    className="text-primary hover:underline flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Монтажная смета #{meId}
                    <ExternalLink className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label className="text-muted-foreground">Дата МП</Label>
            {isEditing && editFormData ? (
              <Input
                type="date"
                value={editFormData.date}
                onChange={(e) => onFieldChange('date', e.target.value)}
                className="mt-1"
                aria-label="Дата МП"
              />
            ) : (
              <div className="mt-1 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">{formatDate(mp.date)}</span>
              </div>
            )}
          </div>

          <div>
            <Label className="text-muted-foreground">Статус</Label>
            {isEditing && editFormData ? (
              <select
                value={editFormData.status}
                onChange={(e) => onFieldChange('status', e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Статус МП"
              >
                {MP_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : null}
          </div>

          <div>
            <Label className="text-muted-foreground">Примечания</Label>
            {isEditing && editFormData ? (
              <textarea
                value={editFormData.notes}
                onChange={(e) => onFieldChange('notes', e.target.value)}
                rows={3}
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Примечания"
              />
            ) : (
              mp.notes ? (
                <div className="mt-1 text-foreground whitespace-pre-wrap">{mp.notes}</div>
              ) : (
                <div className="mt-1 text-muted-foreground">—</div>
              )
            )}
          </div>

          {mp.file_url && (
            <div>
              <Label className="text-muted-foreground">Файл МП</Label>
              <div className="mt-1">
                <a
                  href={mp.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Открыть файл
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Финансовая информация */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h2 className="text-foreground mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-600" />
          Финансовая информация
        </h2>
        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground">Общая сумма (₽)</Label>
            {isEditing && editFormData ? (
              <Input
                type="number"
                step="0.01"
                value={editFormData.total_amount}
                onChange={(e) => onFieldChange('total_amount', e.target.value)}
                className="mt-1"
                aria-label="Общая сумма"
              />
            ) : (
              <div className="mt-1 bg-primary/10 rounded-lg p-4">
                <div className="text-blue-900">{formatCurrency(mp.total_amount)}</div>
              </div>
            )}
          </div>

          <div>
            <Label className="text-muted-foreground">Трудозатраты (чел/час)</Label>
            {isEditing && editFormData ? (
              <Input
                type="number"
                step="0.01"
                value={editFormData.man_hours}
                onChange={(e) => onFieldChange('man_hours', e.target.value)}
                className="mt-1"
                aria-label="Трудозатраты"
              />
            ) : (
              parseFloat(mp.man_hours) > 0 ? (
                <div className="mt-1 bg-purple-50 rounded-lg p-4">
                  <div className="text-purple-900 flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    {parseFloat(mp.man_hours).toFixed(2)} чел/час
                  </div>
                </div>
              ) : (
                <div className="mt-1 text-muted-foreground">—</div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Информация о создании */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h2 className="text-foreground mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-purple-600" />
          Информация о создании
        </h2>
        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground">Создал</Label>
            <div className="mt-1 text-foreground">{mp.created_by_name}</div>
          </div>
          <div>
            <Label className="text-muted-foreground">Дата создания</Label>
            <div className="mt-1 text-foreground">{formatDateTime(mp.created_at)}</div>
          </div>
          {mp.updated_at !== mp.created_at && (
            <div>
              <Label className="text-muted-foreground">Последнее обновление</Label>
              <div className="mt-1 text-foreground">{formatDateTime(mp.updated_at)}</div>
            </div>
          )}
          {mp.telegram_published && mp.telegram_published_at && (
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-muted-foreground mb-1 flex items-center gap-2">
                <Send className="w-4 h-4 text-green-600" />
                Опубликовано в Telegram
              </div>
              <div className="text-green-900">{formatDateTime(mp.telegram_published_at)}</div>
            </div>
          )}
        </div>
      </div>

      {/* История версий */}
      {versions && versions.length > 0 && (
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <h2 className="text-foreground mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-orange-600" />
            История версий ({versions.length})
          </h2>
          <div className="space-y-2">
            {versions.map((version) => (
              <div
                key={version.id}
                className={`p-3 rounded-lg border ${
                  version.id === mp.id ? 'bg-primary/10 border-primary/20' : 'bg-muted border-border'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-foreground flex items-center gap-2">
                      Версия {version.version_number}
                      {version.telegram_published && (
                        <Send className="w-3 h-3 text-green-600" aria-label="Опубликовано в Telegram" />
                      )}
                    </div>
                    <div className="text-muted-foreground">{formatDate(version.date)}</div>
                  </div>
                  {version.id !== mp.id && (
                    <Button
                      onClick={() => navigate(`/proposals/mounting-proposals/${version.id}`)}
                      className="bg-muted text-foreground hover:bg-muted"
                      aria-label={`Открыть версию ${version.version_number}`}
                    >
                      Открыть
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Вкладка «Условия» ───────────────────────────────────────────────────────

function ConditionsTab({ mp }: { mp: MPDetailType }) {
  if (mp.conditions.length === 0) {
    return (
      <div className="bg-card rounded-lg shadow-sm border border-border p-12">
        <div className="text-center text-muted-foreground">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p>Условия не добавлены</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-6">
      <h2 className="text-foreground mb-4">Условия для МП</h2>
      <div className="space-y-4">
        {mp.conditions.map((condition, index) => (
          <div
            key={condition.id}
            className="border border-border rounded-lg p-4 hover:border-blue-300 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="bg-blue-100 dark:bg-blue-900/30 text-primary rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                {index + 1}
              </div>
              <div className="flex-1">
                <h3 className="text-foreground mb-1">{condition.name}</h3>
                {condition.description && (
                  <p className="text-muted-foreground">{condition.description}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
