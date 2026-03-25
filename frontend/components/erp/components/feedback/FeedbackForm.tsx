'use client';

import { useState, useCallback } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScreenshotDropZone } from './ScreenshotDropZone';

interface FeedbackFormProps {
  onSubmit: (text: string, files: File[]) => Promise<void>;
  placeholder?: string;
  compact?: boolean;
}

export function FeedbackForm({ onSubmit, placeholder, compact }: FeedbackFormProps) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    try {
      await onSubmit(trimmed, files);
      setText('');
      setFiles([]);
    } finally {
      setIsSubmitting(false);
    }
  }, [text, files, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="space-y-2">
      <Textarea
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Опишите замечание или предложение...'}
        rows={compact ? 2 : 3}
        className="resize-none"
        disabled={isSubmitting}
      />
      <ScreenshotDropZone files={files} onFilesChange={setFiles} compact={compact} />
      <div className="flex justify-end">
        <Button
          size={compact ? 'sm' : 'default'}
          onClick={handleSubmit}
          disabled={!text.trim() || isSubmitting}
        >
          <Send className="w-4 h-4 mr-1.5" />
          {isSubmitting ? 'Отправка...' : 'Отправить'}
        </Button>
      </div>
    </div>
  );
}
