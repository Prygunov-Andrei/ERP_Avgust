import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Brain, Globe, Factory, Loader2, RotateCcw } from 'lucide-react';
import { PROVIDERS, PROVIDER_COLORS, LANGUAGES, type SearchConfigFormData } from './constants';
import type { PromptsConfig } from '../../services/searchConfigService';

type StepPromptsProps = {
  formData: SearchConfigFormData;
  onChange: (data: SearchConfigFormData) => void;
  selectedProviders: string[];
  defaultPrompts: PromptsConfig | null;
  loadingPrompts: boolean;
  promptLangTab: string;
  onPromptLangTabChange: (tab: string) => void;
};

export function StepPrompts({
  formData, onChange, selectedProviders, defaultPrompts,
  loadingPrompts, promptLangTab, onPromptLangTabChange,
}: StepPromptsProps) {
  const getNestedValue = (obj: Record<string, unknown> | object | undefined, parts: string[]): string => {
    let current: unknown = obj;
    for (const part of parts) {
      if (current && typeof current === 'object' && current !== null) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return '';
      }
    }
    return typeof current === 'string' ? current : '';
  };

  const getPromptValue = (path: string): string => {
    const parts = path.split('.');
    const value = getNestedValue(formData.prompts, parts);
    if (value) return value;
    return getNestedValue(defaultPrompts ?? undefined, parts) || '';
  };

  const setPromptValue = (path: string, value: string) => {
    const parts = path.split('.');
    const newPrompts: Record<string, unknown> = { ...formData.prompts };
    let current: Record<string, unknown> = newPrompts;
    for (let i = 0; i < parts.length - 1; i++) {
      const existing = current[parts[i]];
      if (!existing || typeof existing !== 'object') current[parts[i]] = {};
      else current[parts[i]] = { ...(existing as Record<string, unknown>) };
      current = current[parts[i]] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
    onChange({ ...formData, prompts: newPrompts });
  };

  const handleResetPrompts = () => {
    if (defaultPrompts) {
      onChange({ ...formData, prompts: { ...defaultPrompts } });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-semibold">Настройка промптов</Label>
          <p className="text-sm text-muted-foreground mt-1">Пустые поля означают "использовать стандартные промпты"</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleResetPrompts} disabled={loadingPrompts || !defaultPrompts} className="flex items-center gap-2">
          <RotateCcw className="w-3 h-3" />Сбросить к стандартным
        </Button>
      </div>

      {loadingPrompts ? (
        <Card className="p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Загрузка промптов...</p>
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={['system']} className="space-y-2">
          <AccordionItem value="system" className="border rounded-lg">
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex items-center gap-2"><Brain className="w-4 h-4" /><span>Системные промпты</span></div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-4">
              <p className="text-xs text-muted-foreground">Вступительная инструкция для модели. Задаёт роль и контекст. Переменные: {'{current_date}'}</p>
              {selectedProviders.map((provider) => (
                <div key={provider}>
                  <Label className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${PROVIDER_COLORS[provider]}`} />
                    {PROVIDERS.find(p => p.value === provider)?.label}
                  </Label>
                  <Textarea value={getPromptValue(`system_prompts.${provider}`)} onChange={(e) => setPromptValue(`system_prompts.${provider}`, e.target.value)} placeholder="Оставьте пустым для стандартного промпта" rows={3} className="font-mono text-xs" />
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="search" className="border rounded-lg">
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex items-center gap-2"><Globe className="w-4 h-4" /><span>Шаблоны поиска по языкам</span></div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <p className="text-xs text-muted-foreground mb-3">Что именно модель будет искать на сайтах каждого языка. Переменные: {'{url}'}, {'{name}'}, {'{start_date}'}, {'{end_date}'}</p>
              <Tabs value={promptLangTab} onValueChange={onPromptLangTabChange}>
                <TabsList className="mb-3">
                  {LANGUAGES.map((lang) => <TabsTrigger key={lang.code} value={lang.code} className="text-xs">{lang.label}</TabsTrigger>)}
                </TabsList>
                {LANGUAGES.map((lang) => (
                  <TabsContent key={lang.code} value={lang.code} className="space-y-3">
                    <div>
                      <Label className="text-xs">Основной промпт</Label>
                      <Textarea value={getPromptValue(`search_prompts.${lang.code}.main`)} onChange={(e) => setPromptValue(`search_prompts.${lang.code}.main`, e.target.value)} placeholder="Оставьте пустым для стандартного" rows={4} className="mt-1 font-mono text-xs" />
                    </div>
                    <div>
                      <Label className="text-xs">Формат ответа (JSON)</Label>
                      <Textarea value={getPromptValue(`search_prompts.${lang.code}.json_format`)} onChange={(e) => setPromptValue(`search_prompts.${lang.code}.json_format`, e.target.value)} placeholder="Оставьте пустым для стандартного" rows={4} className="mt-1 font-mono text-xs" />
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="manufacturer" className="border rounded-lg">
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex items-center gap-2"><Factory className="w-4 h-4" /><span>Промпты для производителей</span></div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-4">
              <p className="text-xs text-muted-foreground">Как искать новости по конкретным производителям. Переменные: {'{manufacturer_name}'}, {'{start_date}'}, {'{end_date}'}, {'{websites}'}, {'{json_format}'}</p>
              <div>
                <Label className="text-xs">С указанными сайтами</Label>
                <Textarea value={getPromptValue('manufacturer_prompts.with_websites')} onChange={(e) => setPromptValue('manufacturer_prompts.with_websites', e.target.value)} placeholder="Оставьте пустым для стандартного" rows={4} className="mt-1 font-mono text-xs" />
              </div>
              <div>
                <Label className="text-xs">Без сайтов</Label>
                <Textarea value={getPromptValue('manufacturer_prompts.without_websites')} onChange={(e) => setPromptValue('manufacturer_prompts.without_websites', e.target.value)} placeholder="Оставьте пустым для стандартного" rows={4} className="mt-1 font-mono text-xs" />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}
