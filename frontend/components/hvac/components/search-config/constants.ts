import { Settings, Brain, FileText, DollarSign, Shield } from 'lucide-react';
import type { Provider, SearchContextSize } from '../../services/searchConfigService';

export const PROVIDERS: { value: Provider; label: string; description: string; color: string }[] = [
  { value: 'grok', label: 'Grok (xAI)', description: 'Быстрый поиск с интернет-доступом', color: 'purple' },
  { value: 'anthropic', label: 'Claude (Anthropic)', description: 'Глубокий анализ текста', color: 'orange' },
  { value: 'gemini', label: 'Gemini (Google)', description: 'Мультимодальная модель', color: 'blue' },
  { value: 'openai', label: 'OpenAI GPT', description: 'Универсальная модель с веб-поиском', color: 'green' },
];

export const CONTEXT_SIZES: { value: SearchContextSize; label: string }[] = [
  { value: 'low', label: 'Low (экономный)' },
  { value: 'medium', label: 'Medium (баланс)' },
  { value: 'high', label: 'High (максимум)' },
];

export const WIZARD_STEPS = [
  { id: 1, title: 'Название и провайдеры', icon: Settings },
  { id: 2, title: 'Модели и параметры', icon: Brain },
  { id: 3, title: 'Промпты', icon: FileText },
  { id: 4, title: 'Стоимость', icon: DollarSign },
  { id: 5, title: 'Проверка и сохранение', icon: Shield },
];

export const LANGUAGES = [
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
];

export const PROVIDER_COLORS: Record<string, string> = {
  grok: 'bg-purple-500',
  anthropic: 'bg-orange-500',
  gemini: 'bg-blue-500',
  openai: 'bg-green-500',
};

export type SearchConfigFormData = {
  name: string;
  primary_provider: Provider;
  fallback_chain: string[];
  temperature: number;
  timeout: number;
  max_news_per_resource: number;
  delay_between_requests: number;
  max_search_results: number;
  search_context_size: SearchContextSize;
  grok_model: string;
  anthropic_model: string;
  gemini_model: string;
  openai_model: string;
  grok_input_price: number;
  grok_output_price: number;
  anthropic_input_price: number;
  anthropic_output_price: number;
  gemini_input_price: number;
  gemini_output_price: number;
  openai_input_price: number;
  openai_output_price: number;
  prompts: Record<string, unknown>;
};

export const DEFAULT_FORM_DATA: SearchConfigFormData = {
  name: '',
  primary_provider: 'grok',
  fallback_chain: [],
  temperature: 0.3,
  timeout: 120,
  max_news_per_resource: 10,
  delay_between_requests: 0.5,
  max_search_results: 5,
  search_context_size: 'low',
  grok_model: 'grok-4-1-fast',
  anthropic_model: 'claude-3-5-haiku-20241022',
  gemini_model: 'gemini-2.0-flash-exp',
  openai_model: 'gpt-4o',
  grok_input_price: 3.0,
  grok_output_price: 15.0,
  anthropic_input_price: 0.80,
  anthropic_output_price: 4.0,
  gemini_input_price: 0.075,
  gemini_output_price: 0.30,
  openai_input_price: 2.50,
  openai_output_price: 10.0,
  prompts: {},
};
