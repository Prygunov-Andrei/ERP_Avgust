import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Zap, AlertCircle } from 'lucide-react';
import { PROVIDERS, PROVIDER_COLORS, CONTEXT_SIZES, type SearchConfigFormData } from './constants';
import type { SearchContextSize } from '../../services/searchConfigService';

type StepModelsProps = {
  formData: SearchConfigFormData;
  onChange: (data: SearchConfigFormData) => void;
  selectedProviders: string[];
};

export function StepModels({ formData, onChange, selectedProviders }: StepModelsProps) {
  return (
    <div className="space-y-6">
      <div>
        <Label className="text-base font-semibold">Модели LLM</Label>
        <p className="text-sm text-muted-foreground mt-1 mb-3">Какую модель использовать для каждого провайдера</p>
        <div className="space-y-3">
          {selectedProviders.map((provider) => (
            <div key={provider} className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${PROVIDER_COLORS[provider]}`} />
              <Label className="w-24 flex-shrink-0 text-sm">{PROVIDERS.find(p => p.value === provider)?.label?.split(' ')[0]}</Label>
              <Input
                value={formData[`${provider}_model` as keyof SearchConfigFormData] as string}
                onChange={(e) => onChange({ ...formData, [`${provider}_model`]: e.target.value })}
                className="flex-1"
                placeholder={`Модель для ${provider}`}
              />
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="temperature">Температура</Label>
          <span className="text-sm font-mono text-muted-foreground">{formData.temperature}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 mb-3">Чем выше — тем более разнообразные результаты (0.0 - 1.0)</p>
        <Slider value={[formData.temperature]} onValueChange={([val]) => onChange({ ...formData, temperature: Math.round(val * 10) / 10 })} min={0} max={1} step={0.1} className="mt-2" />
      </div>

      <div>
        <Label htmlFor="timeout">Таймаут (секунды)</Label>
        <p className="text-xs text-muted-foreground mt-1 mb-2">Сколько секунд ждать ответа от модели</p>
        <Input id="timeout" type="number" min={30} max={300} value={formData.timeout} onChange={(e) => onChange({ ...formData, timeout: parseInt(e.target.value) || 120 })} />
      </div>

      <div>
        <Label htmlFor="max_news">Макс. новостей с источника</Label>
        <p className="text-xs text-muted-foreground mt-1 mb-2">Сколько новостей брать с одного сайта за один поиск</p>
        <Input id="max_news" type="number" min={1} max={50} value={formData.max_news_per_resource} onChange={(e) => onChange({ ...formData, max_news_per_resource: parseInt(e.target.value) || 10 })} />
      </div>

      <div>
        <Label htmlFor="delay">Задержка между запросами (сек)</Label>
        <p className="text-xs text-muted-foreground mt-1 mb-2">Пауза между запросами, чтобы не перегрузить сервис</p>
        <Input id="delay" type="number" step={0.1} min={0} max={10} value={formData.delay_between_requests} onChange={(e) => onChange({ ...formData, delay_between_requests: parseFloat(e.target.value) || 0.5 })} />
      </div>

      {selectedProviders.includes('grok') && (
        <>
          <Separator />
          <div>
            <Label className="text-base font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-500" />Grok Web Search
            </Label>
            <Card className="p-3 bg-amber-50 dark:bg-amber-950/20 border-amber-200 mt-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">max_search_results критически влияет на стоимость. Рекомендуется 3-5.</p>
              </div>
            </Card>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <Label htmlFor="max_search_results">Max Search Results</Label>
                <Input id="max_search_results" type="number" min={1} max={20} value={formData.max_search_results} onChange={(e) => onChange({ ...formData, max_search_results: parseInt(e.target.value) || 5 })} className="mt-2" />
              </div>
              <div>
                <Label htmlFor="search_context_size">Context Size</Label>
                <Select value={formData.search_context_size} onValueChange={(value: SearchContextSize) => onChange({ ...formData, search_context_size: value })}>
                  <SelectTrigger id="search_context_size" className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTEXT_SIZES.map((size) => <SelectItem key={size.value} value={size.value}>{size.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
