import React from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { HvacTranslationStatus } from '@/lib/api/types/hvac';

interface TranslationBadgeProps {
  status?: HvacTranslationStatus | null;
  error?: string | null;
  onRetry?: () => void;
  retrying?: boolean;
}

export default function TranslationBadge({ status, error, onRetry, retrying }: TranslationBadgeProps) {
  if (!status || status === 'completed') return null;

  if (status === 'pending' || status === 'in_progress') {
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="w-3 h-3 animate-spin" />
        Перевод…
      </Badge>
    );
  }

  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-2">
        <Badge
          variant="destructive"
          className="gap-1"
          title={error || 'Ошибка перевода'}
        >
          <AlertTriangle className="w-3 h-3" />
          Ошибка перевода
        </Badge>
        {onRetry && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onRetry(); }}
            disabled={retrying}
            className="text-xs text-primary hover:underline disabled:opacity-50"
          >
            {retrying ? 'Запуск…' : 'Повторить'}
          </button>
        )}
      </span>
    );
  }

  return null;
}
