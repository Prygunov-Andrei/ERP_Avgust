import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Info } from 'lucide-react';
import { PROVIDERS, PROVIDER_COLORS, type SearchConfigFormData } from './constants';

type StepCostProps = {
  formData: SearchConfigFormData;
  onChange: (data: SearchConfigFormData) => void;
  selectedProviders: string[];
  estimatedCost: number;
};

export function StepCost({ formData, onChange, selectedProviders, estimatedCost }: StepCostProps) {
  return (
    <div className="space-y-6">
      <div>
        <Label className="text-base font-semibold">Тарифы за 1М токенов (USD)</Label>
        <p className="text-sm text-muted-foreground mt-1 mb-4">Цены используются для расчёта стоимости поиска</p>
        <div className="space-y-4">
          {selectedProviders.map((provider) => {
            const providerInfo = PROVIDERS.find(p => p.value === provider);
            return (
              <Card key={provider} className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-3 h-3 rounded-full ${PROVIDER_COLORS[provider]}`} />
                  <span className="font-medium text-sm">{providerInfo?.label}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Input (за 1М)</Label>
                    <Input type="number" step={0.01} value={formData[`${provider}_input_price` as keyof SearchConfigFormData] as number} onChange={(e) => onChange({ ...formData, [`${provider}_input_price`]: parseFloat(e.target.value) || 0 })} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Output (за 1М)</Label>
                    <Input type="number" step={0.01} value={formData[`${provider}_output_price` as keyof SearchConfigFormData] as number} onChange={(e) => onChange({ ...formData, [`${provider}_output_price`]: parseFloat(e.target.value) || 0 })} className="mt-1" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <Separator />

      <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-blue-900 dark:text-blue-100">Примерная стоимость одного запуска</p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">~20 источников x ~2000 input + ~1000 output токенов</p>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-2">~${estimatedCost.toFixed(4)}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
