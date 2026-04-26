import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from '@/hooks/erp-router';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
import acRatingService from '../services/acRatingService';
import type {
  ACCriterionGroup,
  ACCriterionListItem,
  ACPreset,
  ACPresetWritable,
} from '../services/acRatingTypes';

const GROUP_LABEL: Record<ACCriterionGroup, string> = {
  climate: 'Климат',
  compressor: 'Компрессор',
  acoustics: 'Акустика',
  control: 'Управление',
  dimensions: 'Габариты',
  other: 'Прочее',
};

const GROUP_ORDER: ACCriterionGroup[] = [
  'climate',
  'compressor',
  'acoustics',
  'control',
  'dimensions',
  'other',
];

interface ACPresetEditorProps {
  mode?: 'create' | 'edit';
}

export default function ACPresetEditor({ mode: modeProp }: ACPresetEditorProps) {
  const params = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const mode: 'create' | 'edit' = modeProp ?? (params?.id ? 'edit' : 'create');
  const presetId = params?.id ? Number(params.id) : null;

  const [preset, setPreset] = useState<ACPreset | null>(null);
  const [slug, setSlug] = useState('');
  const [label, setLabel] = useState('');
  const [order, setOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [description, setDescription] = useState('');
  const [isAllSelected, setIsAllSelected] = useState(false);
  const [criteriaIds, setCriteriaIds] = useState<number[]>([]);

  const [criteria, setCriteria] = useState<ACCriterionListItem[]>([]);
  const [criteriaLoading, setCriteriaLoading] = useState(true);
  const [criteriaSearch, setCriteriaSearch] = useState('');
  const [openGroups, setOpenGroups] = useState<Set<ACCriterionGroup>>(
    new Set(GROUP_ORDER)
  );

  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    setCriteriaLoading(true);
    acRatingService
      .getCriteria({ ordering: 'code', is_active: 'true' })
      .then((r) => setCriteria(r.items))
      .catch(() => setCriteria([]))
      .finally(() => setCriteriaLoading(false));

    if (mode !== 'edit' || presetId === null) return;
    setLoading(true);
    setError(null);
    acRatingService
      .getPreset(presetId)
      .then((p) => {
        setPreset(p);
        setSlug(p.slug);
        setLabel(p.label);
        setOrder(String(p.order));
        setIsActive(p.is_active);
        setDescription(p.description);
        setIsAllSelected(p.is_all_selected);
        setCriteriaIds(p.criteria_ids || []);
      })
      .catch((err: unknown) => {
        const status = axios.isAxiosError(err)
          ? err.response?.status
          : undefined;
        setError(
          status === 404 ? 'Пресет не найден' : 'Не удалось загрузить пресет'
        );
      })
      .finally(() => setLoading(false));
  }, [mode, presetId]);

  const toggleGroup = (g: ACCriterionGroup) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const toggleCriterion = (id: number) => {
    setCriteriaIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const groupedCriteria = useMemo(() => {
    const filter = criteriaSearch.trim().toLowerCase();
    const groups: Record<ACCriterionGroup, ACCriterionListItem[]> = {
      climate: [],
      compressor: [],
      acoustics: [],
      control: [],
      dimensions: [],
      other: [],
    };
    for (const c of criteria) {
      if (
        filter &&
        !c.code.toLowerCase().includes(filter) &&
        !c.name_ru.toLowerCase().includes(filter)
      ) {
        continue;
      }
      const g = (groups[c.group] ? c.group : 'other') as ACCriterionGroup;
      groups[g].push(c);
    }
    return groups;
  }, [criteria, criteriaSearch]);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!label.trim()) next.label = 'Поле обязательно';
    if (mode === 'create' && !slug.trim()) next.slug = 'Поле обязательно';
    if (order.trim() !== '') {
      const n = Number(order);
      if (!Number.isFinite(n) || !Number.isInteger(n)) {
        next.order = 'Введите целое число';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildPayload = (): ACPresetWritable => {
    const payload: ACPresetWritable = {
      label: label.trim(),
      order: order.trim() === '' ? 0 : Number(order),
      is_active: isActive,
      description: description,
      is_all_selected: isAllSelected,
      criteria_ids: isAllSelected ? [] : criteriaIds,
    };
    if (slug.trim()) payload.slug = slug.trim();
    return payload;
  };

  const handleSave = async () => {
    if (!validate()) {
      toast.error('Проверьте обязательные поля');
      return;
    }
    setSaving(true);
    try {
      if (mode === 'create') {
        const created = await acRatingService.createPreset(buildPayload());
        toast.success('Пресет создан');
        navigate(`/hvac-rating/presets/edit/${created.id}`);
      } else if (presetId !== null) {
        const updated = await acRatingService.updatePreset(
          presetId,
          buildPayload()
        );
        setPreset(updated);
        toast.success('Сохранено');
      }
    } catch (err: unknown) {
      const data = axios.isAxiosError(err)
        ? (err.response?.data as Record<string, unknown> | undefined)
        : undefined;
      const detailMsg =
        data && typeof data.detail === 'string'
          ? data.detail
          : data && typeof data.slug === 'string'
          ? `slug: ${data.slug}`
          : data && Array.isArray(data.slug) && typeof data.slug[0] === 'string'
          ? `slug: ${data.slug[0]}`
          : null;
      toast.error(detailMsg || 'Не удалось сохранить пресет');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (presetId === null) return;
    setDeleting(true);
    try {
      await acRatingService.deletePreset(presetId);
      toast.success('Пресет удалён');
      navigate('/hvac-rating/presets');
    } catch {
      toast.error('Не удалось удалить пресет');
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center text-muted-foreground">
          Загрузка...
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="p-6 border-destructive bg-destructive/10">
          <p className="text-destructive">{error}</p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => navigate('/hvac-rating/presets')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />К списку
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/hvac-rating/presets')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />К списку
            </Button>
            <h1>
              {mode === 'create'
                ? 'Новый пресет'
                : `Пресет: ${preset?.label ?? ''}`}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'edit' && (
              <Button
                variant="outline"
                onClick={() => setDeleteOpen(true)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Удалить
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => navigate('/hvac-rating/presets')}
            >
              Отмена
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              data-testid="ac-preset-save"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </div>

        <Card className="p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ac-preset-label">
                Label <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ac-preset-label"
                className="mt-1"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                data-testid="ac-preset-label"
              />
              {errors.label && (
                <p className="text-xs text-destructive mt-1">{errors.label}</p>
              )}
            </div>
            <div>
              <Label htmlFor="ac-preset-slug">
                Slug{' '}
                {mode === 'create' && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id="ac-preset-slug"
                className="mt-1 font-mono text-sm"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="my-preset"
                data-testid="ac-preset-slug"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Используется как ключ таба в публичном URL.
              </p>
              {errors.slug && (
                <p className="text-xs text-destructive mt-1">{errors.slug}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ac-preset-order">Order</Label>
              <Input
                id="ac-preset-order"
                type="number"
                className="mt-1"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
              />
              {errors.order && (
                <p className="text-xs text-destructive mt-1">{errors.order}</p>
              )}
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch
                id="ac-preset-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="ac-preset-active">
                Активен (показывать таб на портале)
              </Label>
            </div>
          </div>

          <div>
            <Label htmlFor="ac-preset-description">Описание</Label>
            <Textarea
              id="ac-preset-description"
              className="mt-1"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Короткое описание пресета (опционально)"
            />
          </div>

          <div className="flex items-center gap-3 pt-2 border-t">
            <Switch
              id="ac-preset-all-selected"
              checked={isAllSelected}
              onCheckedChange={setIsAllSelected}
              data-testid="ac-preset-all-selected"
            />
            <Label
              htmlFor="ac-preset-all-selected"
              className="cursor-pointer flex-1"
            >
              «Выбирает все критерии» — пресет автоматически включает все
              активные критерии активной методики.
            </Label>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold">Критерии</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {isAllSelected
                  ? 'Игнорируется при «выбирает все критерии»'
                  : `Выбрано: ${criteriaIds.length}`}
              </p>
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={criteriaSearch}
                onChange={(e) => setCriteriaSearch(e.target.value)}
                placeholder="Поиск по code / названию"
                className="pl-9"
                disabled={isAllSelected}
                data-testid="ac-preset-criteria-search"
              />
            </div>
          </div>

          {criteriaLoading && (
            <p className="text-muted-foreground text-sm">Загрузка критериев...</p>
          )}

          {!criteriaLoading && criteria.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Нет активных критериев. Создайте их в разделе «Критерии».
            </p>
          )}

          {!criteriaLoading && criteria.length > 0 && (
            <div
              className={`space-y-2 ${
                isAllSelected ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              {GROUP_ORDER.map((g) => {
                const items = groupedCriteria[g];
                if (items.length === 0) return null;
                const isOpen = openGroups.has(g);
                const selectedInGroup = items.filter((c) =>
                  criteriaIds.includes(c.id)
                ).length;
                return (
                  <Card key={g} className="p-0 overflow-hidden">
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/40 text-left"
                      onClick={() => toggleGroup(g)}
                    >
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="font-medium">{GROUP_LABEL[g]}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {selectedInGroup} / {items.length}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="border-t px-4 py-3 space-y-2">
                        {items.map((c) => (
                          <label
                            key={c.id}
                            className="flex items-start gap-3 cursor-pointer hover:bg-muted/30 rounded px-2 py-1"
                            data-testid={`ac-preset-criterion-${c.id}`}
                          >
                            <Checkbox
                              checked={criteriaIds.includes(c.id)}
                              onCheckedChange={() => toggleCriterion(c.id)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm">{c.name_ru}</div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {c.code}
                                {c.unit ? ` · ${c.unit}` : ''}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить пресет?</AlertDialogTitle>
            <AlertDialogDescription>
              Действие необратимо. Соответствующий таб «Свой рейтинг» исчезнет с
              публичного портала.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Удаление...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
