import { useState, useEffect } from 'react';
import { useParams, useNavigate } from '@/hooks/erp-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useBreadcrumb } from '@/hooks/useBreadcrumb';
import { ArrowLeft, AlertCircle, Pencil, Trash2, Copy, FileText, Save, X, ChevronDown } from 'lucide-react';
import {
  api,
  unwrapResults,
  TechnicalProposalDetail as TKPDetail,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CreateMountingProposalFromTKPDialog } from "./CreateMountingProposalFromTKPDialog";
import { CreateVersionDialog } from "./CreateVersionDialog";
import { formatDate, getStatusBadgeClass, getStatusLabel } from '@/lib/utils';
import { CONSTANTS } from '@/constants';
import { useObjects, useLegalEntities } from '@/hooks';
import { InfoTab, EditFormData } from './tkp/InfoTab';
import { EstimatesTab } from './tkp/EstimatesTab';
import { SectionsTab } from './tkp/SectionsTab';
import { CharacteristicsTab } from './tkp/CharacteristicsTab';
import { FrontOfWorkTab } from './tkp/FrontOfWorkTab';

type TabType =
  | "info"
  | "estimates"
  | "sections"
  | "characteristics"
  | "front";

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Черновик' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'checking', label: 'На проверке' },
  { value: 'approved', label: 'Утверждён' },
  { value: 'sent', label: 'Отправлено Заказчику' },
  { value: 'agreed', label: 'Согласовано Заказчиком' },
  { value: 'rejected', label: 'Отклонено' },
];

export function TechnicalProposalDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("info");
  const [isEditing, setIsEditing] = useState(false);
  const [isMountingProposalDialogOpen, setIsMountingProposalDialogOpen] = useState(false);
  const [isVersionDialogOpen, setIsVersionDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<EditFormData | null>(null);
  const [statusChangeTarget, setStatusChangeTarget] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { setDetailLabel } = useBreadcrumb();

  // Загрузка ТКП
  const { data: tkp, isLoading } = useQuery({
    queryKey: ["technical-proposal", id],
    queryFn: () => api.proposals.getTechnicalProposal(parseInt(id!)),
    enabled: !!id,
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
  });

  useEffect(() => {
    if (tkp) setDetailLabel(`ТКП ${tkp.number}`);
    return () => setDetailLabel(null);
  }, [tkp?.number, setDetailLabel]);

  // Загрузка версий
  const { data: versions } = useQuery({
    queryKey: ["technical-proposals-versions", id],
    queryFn: () =>
      api.proposals.getTechnicalProposalVersions(parseInt(id!)),
    enabled: !!id,
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
  });

  // Загрузка характеристик
  const { data: characteristics } = useQuery({
    queryKey: ["tkp-characteristics", id],
    queryFn: () => api.proposals.getTKPCharacteristics(parseInt(id!)),
    enabled: !!id && activeTab === "characteristics",
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
  });

  // Загрузка фронта работ
  const { data: frontOfWork } = useQuery({
    queryKey: ["tkp-front-of-work", id],
    queryFn: () => api.proposals.getTKPFrontOfWork(parseInt(id!)),
    enabled: !!id && activeTab === "front",
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
  });

  const { data: objectsData } = useObjects(undefined, { enabled: isEditing });
  const objects = unwrapResults(objectsData);
  const { data: legalEntitiesData } = useLegalEntities();
  const legalEntities = unwrapResults(legalEntitiesData);

  // Удаление ТКП
  const deleteMutation = useMutation({
    mutationFn: () =>
      api.proposals.deleteTechnicalProposal(parseInt(id!)),
    onSuccess: () => {
      toast.success("ТКП удалено");
      navigate("/proposals/technical-proposals");
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      api.proposals.updateTechnicalProposal(parseInt(id!), data),
    onSuccess: () => {
      toast.success("ТКП обновлено");
      queryClient.invalidateQueries({ queryKey: ["technical-proposal", id] });
      queryClient.invalidateQueries({ queryKey: ["technical-proposals"] });
      setIsEditing(false);
      setEditFormData(null);
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  const statusMutation = useMutation({
    mutationFn: (newStatus: string) => {
      const formData = new FormData();
      formData.append('status', newStatus);
      return api.proposals.updateTechnicalProposal(parseInt(id!), formData);
    },
    onSuccess: () => {
      toast.success("Статус обновлён");
      queryClient.invalidateQueries({ queryKey: ["technical-proposal", id] });
      queryClient.invalidateQueries({ queryKey: ["technical-proposals"] });
      setStatusChangeTarget(null);
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
      setStatusChangeTarget(null);
    },
  });

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === tkp?.status) return;
    setStatusChangeTarget(newStatus);
  };

  const handleConfirmStatusChange = () => {
    if (!statusChangeTarget) return;
    statusMutation.mutate(statusChangeTarget);
  };

  const handleStartEditing = () => {
    if (!tkp) return;
    setEditFormData({
      name: tkp.name,
      date: tkp.date,
      due_date: tkp.due_date || '',
      outgoing_number: tkp.outgoing_number || '',
      object: tkp.object.toString(),
      object_area: tkp.object_area?.toString() || '',
      legal_entity: tkp.legal_entity.toString(),
      advance_required: tkp.advance_required || '',
      work_duration: tkp.work_duration || '',
      validity_days: tkp.validity_days.toString(),
      notes: tkp.notes || '',
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
    if (editFormData.due_date) formData.append('due_date', editFormData.due_date);
    formData.append('object', editFormData.object);
    if (editFormData.object_area) formData.append('object_area', editFormData.object_area);
    formData.append('legal_entity', editFormData.legal_entity);
    if (editFormData.outgoing_number) formData.append('outgoing_number', editFormData.outgoing_number);
    if (editFormData.advance_required) formData.append('advance_required', editFormData.advance_required);
    if (editFormData.work_duration) formData.append('work_duration', editFormData.work_duration);
    formData.append('validity_days', editFormData.validity_days);
    if (editFormData.notes) formData.append('notes', editFormData.notes);
    updateMutation.mutate(formData);
  };

  const handleDelete = () => {
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    deleteMutation.mutate();
    setIsDeleteDialogOpen(false);
  };

  const getStatusBadge = (status: string) => {
    return (
      <Badge className={getStatusBadgeClass(status)}>{getStatusLabel(status)}</Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  if (!tkp) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
        <div className="text-muted-foreground">ТКП не найдено</div>
        <Button
          onClick={() => navigate("/proposals/technical-proposals")}
          className="mt-4"
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
              onClick={() => navigate("/proposals/technical-proposals")}
              className="bg-muted text-foreground hover:bg-muted px-3"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-foreground">{tkp.name}</h1>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center gap-1 cursor-pointer" aria-label="Сменить статус">
                      {getStatusBadge(tkp.status)}
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {STATUS_OPTIONS.map(opt => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() => handleStatusChange(opt.value)}
                        disabled={opt.value === tkp.status}
                        className={opt.value === tkp.status ? 'font-bold' : ''}
                      >
                        {opt.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                {tkp.is_latest_version && (
                  <Badge className="bg-primary/10 text-primary border border-primary/20">
                    Актуальная версия
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-muted-foreground">
                <span>№ {tkp.number}</span>
                {tkp.outgoing_number && (
                  <span>Исх. № {tkp.outgoing_number}</span>
                )}
                <span>Версия {tkp.version_number}</span>
                <span>от {formatDate(tkp.date)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button
                  onClick={handleSaveEditing}
                  className="bg-green-600 text-white hover:bg-green-700"
                  disabled={updateMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateMutation.isPending ? 'Сохранение...' : 'Сохранить'}
                </Button>
                <Button
                  onClick={handleCancelEditing}
                  className="bg-muted text-foreground hover:bg-muted"
                  disabled={updateMutation.isPending}
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
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Редактировать
                </Button>
                <Button
                  onClick={() => setIsVersionDialogOpen(true)}
                  className="bg-purple-600 text-white hover:bg-purple-700"
                  disabled={!tkp.is_latest_version}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Создать версию
                </Button>
                <Button
                  onClick={handleDelete}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                {tkp.status === "approved" && (
                  <Button
                    onClick={() =>
                      setIsMountingProposalDialogOpen(true)
                    }
                    className="bg-green-600 text-white hover:bg-green-700"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Создать МП
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Вкладки */}
        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setActiveTab("info")}
            className={`px-4 py-2 -mb-px transition-colors ${
              activeTab === "info"
                ? "border-b-2 border-blue-600 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Основная информация
          </button>
          <button
            onClick={() => setActiveTab("estimates")}
            className={`px-4 py-2 -mb-px transition-colors ${
              activeTab === "estimates"
                ? "border-b-2 border-blue-600 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Сметы ({tkp.estimates.length})
          </button>
          <button
            onClick={() => setActiveTab("sections")}
            className={`px-4 py-2 -mb-px transition-colors ${
              activeTab === "sections"
                ? "border-b-2 border-blue-600 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Разделы ({tkp.estimate_sections.length})
          </button>
          <button
            onClick={() => setActiveTab("characteristics")}
            className={`px-4 py-2 -mb-px transition-colors ${
              activeTab === "characteristics"
                ? "border-b-2 border-blue-600 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Характеристики ({tkp.characteristics.length})
          </button>
          <button
            onClick={() => setActiveTab("front")}
            className={`px-4 py-2 -mb-px transition-colors ${
              activeTab === "front"
                ? "border-b-2 border-blue-600 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Фронт работ ({tkp.front_of_work.length})
          </button>
        </div>
      </div>

      {/* Контент вкладок */}
      {activeTab === "info" && (
        <InfoTab
          tkp={tkp}
          versions={versions}
          isEditing={isEditing}
          editFormData={editFormData}
          onFieldChange={(field, value) => setEditFormData(prev => prev ? { ...prev, [field]: value } : null)}
          objects={objects}
          legalEntities={legalEntities}
        />
      )}
      {activeTab === "estimates" && <EstimatesTab tkp={tkp} />}
      {activeTab === "sections" && <SectionsTab tkp={tkp} />}
      {activeTab === "characteristics" && (
        <CharacteristicsTab
          tkpId={parseInt(id!)}
          characteristics={characteristics || []}
        />
      )}
      {activeTab === "front" && (
        <FrontOfWorkTab
          tkpId={parseInt(id!)}
          frontOfWork={frontOfWork || []}
        />
      )}

      {/* Диалог создания монтажного проекта */}
      <CreateMountingProposalFromTKPDialog
        open={isMountingProposalDialogOpen}
        onOpenChange={setIsMountingProposalDialogOpen}
        tkpId={tkp.id}
        tkpNumber={tkp.number}
        tkpName={tkp.name}
        tkpObjectId={tkp.object}
      />

      {/* Диалог создания версии */}
      <CreateVersionDialog
        open={isVersionDialogOpen}
        onOpenChange={setIsVersionDialogOpen}
        itemId={tkp.id}
        itemType="tkp"
        currentDate={tkp.date}
        currentVersionNumber={tkp.version_number}
      />

      {/* Диалог подтверждения смены статуса */}
      <AlertDialog open={!!statusChangeTarget} onOpenChange={(open) => { if (!open) setStatusChangeTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтверждение смены статуса</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите изменить статус на «{STATUS_OPTIONS.find(o => o.value === statusChangeTarget)?.label}»?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmStatusChange} disabled={statusMutation.isPending}>
              {statusMutation.isPending ? 'Сохранение...' : 'Подтвердить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Диалог подтверждения удаления ТКП */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удаление ТКП</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить ТКП «{tkp?.name}»? Это действие необратимо.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700" disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
