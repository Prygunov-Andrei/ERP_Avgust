'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getHvacIsmetaSettings,
  updateHvacIsmetaSettings,
} from '@/lib/api/services/hvac-ismeta';
import type {
  HvacIsmetaPipeline,
  HvacIsmetaSettings,
} from '@/lib/api/types/hvac-ismeta';

type FormState = Omit<HvacIsmetaSettings, 'id' | 'updated_at'>;

const PIPELINE_OPTIONS: { value: HvacIsmetaPipeline; label: string }[] = [
  { value: 'td17g', label: 'TD-17g (Docling + Camelot + Vision)' },
  { value: 'main', label: 'Main (DeepSeek pure-LLM)' },
];

export default function HvacIsmetaSettingsPage() {
  const [form, setForm] = useState<FormState | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getHvacIsmetaSettings()
      .then((data) => {
        if (cancelled) return;
        const { id: _id, updated_at, ...rest } = data;
        setForm(rest);
        setUpdatedAt(updated_at);
      })
      .catch((err) => {
        if (!cancelled) toast.error(`Не удалось загрузить настройки: ${err.message}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const data = await updateHvacIsmetaSettings(form);
      const { id: _id, updated_at, ...rest } = data;
      setForm(rest);
      setUpdatedAt(updated_at);
      toast.success('Настройки сохранены');
    } catch (err) {
      toast.error(`Ошибка сохранения: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Загрузка настроек…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Настройки публичного ISMeta</h1>
          <p className="text-sm text-muted-foreground">
            Управление публичным сайтом распознавания смет на hvac-info.com/ismeta.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Сохранить
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Доступность</CardTitle>
          <CardDescription>Управление видимостью сервиса для пользователей.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ToggleRow
            label="Сервис включён"
            description="Если выключено, на hvac-info.com/ismeta показывается «Сервис временно недоступен»."
            checked={form.enabled}
            onCheckedChange={(v) => update('enabled', v)}
          />
          <ToggleRow
            label="Требовать регистрацию"
            description="Доступ только для зарегистрированных пользователей. По умолчанию выключено."
            checked={form.require_registration}
            onCheckedChange={(v) => update('require_registration', v)}
          />
          <ToggleRow
            label="Лимит конкурентности"
            description="Только одна загрузка PDF одновременно с одной сессии."
            checked={form.concurrency_limit_enabled}
            onCheckedChange={(v) => update('concurrency_limit_enabled', v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Распознавание</CardTitle>
          <CardDescription>Дефолтные параметры pipeline и LLM-провайдера.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="pipeline">Дефолтный pipeline</Label>
            <Select
              value={form.default_pipeline}
              onValueChange={(v) => update('default_pipeline', v as HvacIsmetaPipeline)}
            >
              <SelectTrigger id="pipeline">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="llm-profile">ID LLM-профиля по умолчанию</Label>
            <Input
              id="llm-profile"
              type="number"
              min={1}
              placeholder="Например, 1 (DeepSeek)"
              value={form.default_llm_profile_id ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                update(
                  'default_llm_profile_id',
                  raw === '' ? null : Number(raw),
                );
              }}
            />
            <p className="text-xs text-muted-foreground">
              Soft-FK на llm_profile.id в ismeta-postgres. Берётся из LLM Profiles UI.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Лимиты загрузок</CardTitle>
          <CardDescription>
            Защита от злоупотреблений: ограничение количества PDF в час и в сутки.
            Хранятся в Redis (бэкенд fail-open при недоступности кэша).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="hourly-per-session">PDF в час с одной сессии</Label>
            <Input
              id="hourly-per-session"
              type="number"
              min={0}
              max={10000}
              value={form.hourly_per_session}
              onChange={(e) => update('hourly_per_session', Number(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">
              Default 5. 0 — без ограничений (не рекомендовано на проде).
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="hourly-per-ip">PDF в час с одного IP</Label>
            <Input
              id="hourly-per-ip"
              type="number"
              min={0}
              max={10000}
              value={form.hourly_per_ip}
              onChange={(e) => update('hourly_per_ip', Number(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">
              Default 10. Покрывает офисы с общим IP.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="daily-per-ip">PDF в сутки с одного IP</Label>
            <Input
              id="daily-per-ip"
              type="number"
              min={0}
              max={100000}
              value={form.daily_per_ip}
              onChange={(e) => update('daily_per_ip', Number(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">
              Default 30. Если офис с 30 сметчиками — увеличить.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Хранение и лимиты</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="storage-path">Путь хранения PDF</Label>
            <Input
              id="storage-path"
              value={form.pdf_storage_path}
              onChange={(e) => update('pdf_storage_path', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-size">Максимальный размер PDF (МБ)</Label>
            <Input
              id="max-size"
              type="number"
              min={1}
              max={500}
              value={form.max_file_size_mb}
              onChange={(e) => update('max_file_size_mb', Number(e.target.value) || 0)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Контакты</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="feedback-email">Email для feedback</Label>
          <Input
            id="feedback-email"
            type="email"
            value={form.feedback_email}
            onChange={(e) => update('feedback_email', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Адрес, на который уходят сообщения из формы обратной связи на публичном сайте.
          </p>
        </CardContent>
      </Card>

      {updatedAt && (
        <p className="text-xs text-muted-foreground">
          Последнее обновление: {new Date(updatedAt).toLocaleString('ru-RU')}
        </p>
      )}
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}

function ToggleRow({ label, description, checked, onCheckedChange }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <Label className="text-sm font-medium">{label}</Label>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
