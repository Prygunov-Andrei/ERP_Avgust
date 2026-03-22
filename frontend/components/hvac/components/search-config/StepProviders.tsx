import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PROVIDERS, PROVIDER_COLORS, type SearchConfigFormData } from './constants';

type StepProvidersProps = {
  formData: SearchConfigFormData;
  onChange: (data: SearchConfigFormData) => void;
};

export function StepProviders({ formData, onChange }: StepProvidersProps) {
  const toggleFallback = (provider: string) => {
    const newChain = formData.fallback_chain.includes(provider)
      ? formData.fallback_chain.filter(p => p !== provider)
      : [...formData.fallback_chain, provider];
    onChange({ ...formData, fallback_chain: newChain });
  };

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="name">Название конфигурации *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => onChange({ ...formData, name: e.target.value })}
          placeholder="Например: Production Config"
          className="mt-2"
        />
      </div>

      <div>
        <Label className="text-base font-semibold">Основной провайдер</Label>
        <p className="text-sm text-muted-foreground mt-1 mb-3">
          Выберите провайдер LLM, который будет использоваться для поиска новостей
        </p>
        <div className="grid grid-cols-2 gap-3">
          {PROVIDERS.map((provider) => (
            <Card
              key={provider.value}
              className={`p-4 cursor-pointer transition-all ${
                formData.primary_provider === provider.value
                  ? 'border-2 border-primary bg-primary/5 shadow-md'
                  : 'border hover:border-primary/50 hover:shadow-sm'
              }`}
              onClick={() => onChange({ ...formData, primary_provider: provider.value })}
              tabIndex={0}
              role="radio"
              aria-checked={formData.primary_provider === provider.value}
              aria-label={provider.label}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onChange({ ...formData, primary_provider: provider.value });
                }
              }}
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full ${PROVIDER_COLORS[provider.value]}`} />
                <div>
                  <p className="font-medium text-sm">{provider.label}</p>
                  <p className="text-xs text-muted-foreground">{provider.description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-base font-semibold">Резервные провайдеры</Label>
        <p className="text-sm text-muted-foreground mt-1 mb-3">
          Провайдеры для fallback при ошибках основного (порядок имеет значение)
        </p>
        <div className="grid grid-cols-2 gap-2">
          {PROVIDERS.filter(p => p.value !== formData.primary_provider).map((provider) => (
            <Card
              key={provider.value}
              className={`p-3 cursor-pointer transition-all ${
                formData.fallback_chain.includes(provider.value)
                  ? 'border-2 border-primary bg-primary/10'
                  : 'border hover:border-primary/50'
              }`}
              onClick={() => toggleFallback(provider.value)}
              tabIndex={0}
              role="checkbox"
              aria-checked={formData.fallback_chain.includes(provider.value)}
              aria-label={`Резервный: ${provider.label}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleFallback(provider.value);
                }
              }}
            >
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${PROVIDER_COLORS[provider.value]}`} />
                <span className="text-sm">{provider.label}</span>
                {formData.fallback_chain.includes(provider.value) && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    #{formData.fallback_chain.indexOf(provider.value) + 1}
                  </Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
