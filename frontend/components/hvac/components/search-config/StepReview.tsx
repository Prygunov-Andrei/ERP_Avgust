import React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { PROVIDERS, PROVIDER_COLORS, type SearchConfigFormData } from './constants';
import type { ProviderCheckResults } from '../../services/searchConfigService';

type StepReviewProps = {
  formData: SearchConfigFormData;
  estimatedCost: number;
  checkingProviders: boolean;
  providerResults: ProviderCheckResults | null;
  onCheckProviders: () => void;
};

export function StepReview({ formData, estimatedCost, checkingProviders, providerResults, onCheckProviders }: StepReviewProps) {
  return (
    <div className="space-y-6">
      <Card className="p-4">
        <Label className="text-base font-semibold">Сводка конфигурации</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          <div><p className="text-xs text-muted-foreground">Название</p><p className="font-medium text-sm mt-1">{formData.name || '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">Основной провайдер</p><div className="flex items-center gap-2 mt-1"><div className={`w-2 h-2 rounded-full ${PROVIDER_COLORS[formData.primary_provider]}`} /><p className="font-medium text-sm">{PROVIDERS.find(p => p.value === formData.primary_provider)?.label}</p></div></div>
          <div><p className="text-xs text-muted-foreground">Резервные</p><p className="font-medium text-sm mt-1">{formData.fallback_chain.length > 0 ? formData.fallback_chain.map(p => PROVIDERS.find(pr => pr.value === p)?.label?.split(' ')[0]).join(', ') : 'Нет'}</p></div>
          <div><p className="text-xs text-muted-foreground">Температура</p><p className="font-medium text-sm mt-1">{formData.temperature}</p></div>
          <div><p className="text-xs text-muted-foreground">Таймаут</p><p className="font-medium text-sm mt-1">{formData.timeout}с</p></div>
          <div><p className="text-xs text-muted-foreground">Max News/Resource</p><p className="font-medium text-sm mt-1">{formData.max_news_per_resource}</p></div>
          <div><p className="text-xs text-muted-foreground">Промпты</p><p className="font-medium text-sm mt-1">{Object.keys(formData.prompts).length > 0 ? 'Кастомные' : 'Стандартные'}</p></div>
          <div><p className="text-xs text-muted-foreground">Примерная стоимость</p><p className="font-medium text-sm mt-1">~${estimatedCost.toFixed(4)}/запуск</p></div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <Label className="text-base font-semibold">Проверка провайдеров</Label>
          <Button variant="outline" size="sm" onClick={onCheckProviders} disabled={checkingProviders} className="flex items-center gap-2">
            {checkingProviders ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
            {checkingProviders ? 'Проверка...' : 'Проверить провайдеров'}
          </Button>
        </div>

        {providerResults ? (
          <div className="space-y-3">
            {Object.entries(providerResults).map(([provider, result]) => (
              <div key={provider} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className={`w-3 h-3 rounded-full ${PROVIDER_COLORS[provider]}`} />
                <span className="font-medium text-sm flex-1">{PROVIDERS.find(p => p.value === provider)?.label}</span>
                {result.available ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-700 dark:text-green-400">Работает</span>
                    {result.balance !== null && <Badge variant="secondary" className="text-xs">${result.balance}</Badge>}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-700 dark:text-red-400">{result.error || 'Недоступен'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">Нажмите "Проверить провайдеров" для проверки доступности API ключей</p>
        )}
      </Card>
    </div>
  );
}
