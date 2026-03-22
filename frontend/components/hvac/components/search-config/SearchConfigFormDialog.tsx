import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Settings, ChevronLeft, ChevronRight, Check, Loader2, Save } from 'lucide-react';
import searchConfigService, {
  SearchConfiguration,
  Provider,
  PromptsConfig,
  ProviderCheckResults,
} from '../../services/searchConfigService';
import { toast } from 'sonner';
import { WIZARD_STEPS, DEFAULT_FORM_DATA, type SearchConfigFormData } from './constants';
import { StepProviders } from './StepProviders';
import { StepModels } from './StepModels';
import { StepPrompts } from './StepPrompts';
import { StepCost } from './StepCost';
import { StepReview } from './StepReview';

interface SearchConfigFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: SearchConfiguration | null;
  onSuccess: () => void;
}

export default function SearchConfigFormDialog({
  open,
  onOpenChange,
  config,
  onSuccess,
}: SearchConfigFormDialogProps) {
  const isEdit = config !== null;
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [defaultPrompts, setDefaultPrompts] = useState<PromptsConfig | null>(null);
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [checkingProviders, setCheckingProviders] = useState(false);
  const [providerResults, setProviderResults] = useState<ProviderCheckResults | null>(null);
  const [promptLangTab, setPromptLangTab] = useState('ru');
  const [formData, setFormData] = useState<SearchConfigFormData>({ ...DEFAULT_FORM_DATA });

  const loadDefaultPrompts = useCallback(async () => {
    if (defaultPrompts) return;
    setLoadingPrompts(true);
    try {
      const data = await searchConfigService.getDefaultPrompts();
      setDefaultPrompts(data);
    } catch (err) {
      console.error('Error loading default prompts:', err);
    } finally {
      setLoadingPrompts(false);
    }
  }, [defaultPrompts]);

  useEffect(() => {
    if (open) {
      setCurrentStep(1);
      setProviderResults(null);
      if (config) {
        setFormData({
          name: config.name,
          primary_provider: config.primary_provider,
          fallback_chain: config.fallback_chain,
          temperature: config.temperature,
          timeout: config.timeout,
          max_news_per_resource: config.max_news_per_resource,
          delay_between_requests: config.delay_between_requests,
          max_search_results: config.max_search_results,
          search_context_size: config.search_context_size,
          grok_model: config.grok_model,
          anthropic_model: config.anthropic_model,
          gemini_model: config.gemini_model,
          openai_model: config.openai_model,
          grok_input_price: config.grok_input_price,
          grok_output_price: config.grok_output_price,
          anthropic_input_price: config.anthropic_input_price,
          anthropic_output_price: config.anthropic_output_price,
          gemini_input_price: config.gemini_input_price,
          gemini_output_price: config.gemini_output_price,
          openai_input_price: config.openai_input_price,
          openai_output_price: config.openai_output_price,
          prompts: (config.prompts || {}) as Record<string, unknown>,
        });
      } else {
        setFormData({ ...DEFAULT_FORM_DATA });
      }
    }
  }, [config, open]);

  useEffect(() => {
    if (currentStep === 3) loadDefaultPrompts();
  }, [currentStep, loadDefaultPrompts]);

  const selectedProviders = [formData.primary_provider, ...formData.fallback_chain.filter(p => p !== formData.primary_provider)];

  const estimateCostPerRun = () => {
    const avgSourcesCount = 20;
    const avgInputTokens = 2000;
    const avgOutputTokens = 1000;
    const provider = formData.primary_provider;
    const inputPriceKey = `${provider}_input_price` as keyof SearchConfigFormData;
    const outputPriceKey = `${provider}_output_price` as keyof SearchConfigFormData;
    const inputPrice = (formData[inputPriceKey] as number) || 0;
    const outputPrice = (formData[outputPriceKey] as number) || 0;
    const costPerRequest = (avgInputTokens * inputPrice + avgOutputTokens * outputPrice) / 1_000_000;
    return costPerRequest * avgSourcesCount;
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { toast.error('Введите название конфигурации'); return; }
    setSaving(true);
    try {
      if (isEdit && config) {
        await searchConfigService.updateConfiguration(config.id, formData);
        toast.success('Конфигурация обновлена');
      } else {
        await searchConfigService.createConfiguration(formData);
        toast.success('Конфигурация создана');
      }
      onSuccess();
    } catch (err: unknown) {
      console.error('Error saving configuration:', err);
      const message = axios.isAxiosError(err)
        ? (err.response?.data as Record<string, string> | undefined)?.detail ?? 'Ошибка сохранения конфигурации'
        : 'Ошибка сохранения конфигурации';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleCheckProviders = async () => {
    setCheckingProviders(true);
    setProviderResults(null);
    try {
      const allProviders = [formData.primary_provider, ...formData.fallback_chain] as Provider[];
      const uniqueProviders = [...new Set(allProviders)];
      const results = await searchConfigService.checkProviders(uniqueProviders);
      setProviderResults(results);
    } catch (err: unknown) {
      console.error('Error checking providers:', err);
      toast.error('Ошибка проверки провайдеров');
    } finally {
      setCheckingProviders(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 1 && !formData.name.trim()) { toast.error('Введите название конфигурации'); return; }
    if (currentStep < 5) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-6 h-6" />
            {isEdit ? 'Редактировать конфигурацию' : 'Создать конфигурацию'}
          </DialogTitle>
          <DialogDescription>Пошаговая настройка параметров автоматического поиска новостей</DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-1 px-2 py-3">
          {WIZARD_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            return (
              <React.Fragment key={step.id}>
                <button
                  type="button"
                  onClick={() => setCurrentStep(step.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                    isActive ? 'bg-primary text-primary-foreground font-medium'
                    : isCompleted ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                  tabIndex={0}
                  aria-label={`Шаг ${step.id}: ${step.title}`}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  <span className="hidden md:inline">{step.title}</span>
                  <span className="md:hidden">{step.id}</span>
                </button>
                {index < WIZARD_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 ${isCompleted ? 'bg-green-400' : 'bg-muted'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-1 pb-2">
          {currentStep === 1 && <StepProviders formData={formData} onChange={setFormData} />}
          {currentStep === 2 && <StepModels formData={formData} onChange={setFormData} selectedProviders={selectedProviders} />}
          {currentStep === 3 && <StepPrompts formData={formData} onChange={setFormData} selectedProviders={selectedProviders} defaultPrompts={defaultPrompts} loadingPrompts={loadingPrompts} promptLangTab={promptLangTab} onPromptLangTabChange={setPromptLangTab} />}
          {currentStep === 4 && <StepCost formData={formData} onChange={setFormData} selectedProviders={selectedProviders} estimatedCost={estimateCostPerRun()} />}
          {currentStep === 5 && <StepReview formData={formData} estimatedCost={estimateCostPerRun()} checkingProviders={checkingProviders} providerResults={providerResults} onCheckProviders={handleCheckProviders} />}
        </div>

        {/* Navigation */}
        <DialogFooter className="flex items-center justify-between border-t pt-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          </div>
          <div className="flex items-center gap-2">
            {currentStep > 1 && (
              <Button variant="outline" onClick={handleBack} className="flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" />Назад
              </Button>
            )}
            {currentStep < 5 ? (
              <Button onClick={handleNext} className="flex items-center gap-1">
                Далее<ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Сохранение...' : isEdit ? 'Сохранить' : 'Создать'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
